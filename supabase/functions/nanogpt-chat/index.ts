// NanoGPT multi-agent chat for ProAds.
// Video generation is ASYNC: this function submits the job and returns { videoJob: { runId, model } }
// immediately. The client polls `nanogpt-video-status` until COMPLETED.
import { requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { extractProposeActions, insertProposals } from "../_shared/proposals.ts";
import { formatSearchForPrompt, shouldWebSearch, webSearch } from "../_shared/web-search.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NANO_BASE = "https://nano-gpt.com";
const DEFAULT_TEXT_MODEL = "zai-org/glm-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_VIDEO_MODEL = "happyhorse-1.1";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

const SYSTEM_PROMPT = `Você é o ProAds Assistant, um time coordenado de agentes de marketing digital dentro de uma plataforma SaaS.

Papéis do time: Diretor de Marketing, Pesquisador, Estrategista, Copywriter, Roteirista, Diretor de Arte, Media Buyer, Analista.

Regras:
- Responda sempre em português brasileiro, tom profissional e direto.
- Use markdown quando ajudar (listas, negrito, tabelas curtas).
- Se o usuário pedir uma IMAGEM / criativo estático / mockup, inclua na resposta:
    <generate_image>DESCRIÇÃO DETALHADA EM INGLÊS</generate_image>
  Duas variantes serão geradas (1:1 Feed e 9:16 Story/Reel).
- Se o usuário pedir um VÍDEO SIMPLES text-to-video, inclua:
    <generate_video>DESCRIÇÃO EM INGLÊS</generate_video>
- Se o usuário pedir um CRIATIVO EM VÍDEO com narração/storytelling, inclua:
    <generate_ad_video>
    SCRIPT: [roteiro em pt-BR, curto ~15-25s, com hook, benefício, CTA]
    ||
    VISUAL: [descrição em inglês do FRAME-CHAVE — cena, iluminação]
    </generate_ad_video>
  Backend gera imagem-âncora e usa como base para vídeo (image-to-video, 9:16, 5s).
- Antes/depois das tags, explique a estratégia (público, ângulo, CTA) em bullets curtos.
- NÃO use as tags se o usuário só quer conversar.`;

const TRAFFIC_MANAGER_PROMPT = `Você é o **Gerente de Tráfego Pago** do ProAds — especialista sênior em Meta Ads, mas fala como consultor de negócio para o DONO DA EMPRESA (não para um media buyer).
Você NÃO é o agente de criativos. NÃO gere tags <generate_image>, <generate_video> ou <generate_ad_video>.

LINGUAGEM (obrigatório):
- Traduza métricas técnicas em impacto de negócio. Em vez de "CPL subiu 18%", diga "cada lead está saindo ~R$ X mais caro — no ritmo atual isso são ~R$ Y a mais por mês".
- Prefira: leads, clientes, receita, custo por resultado, "dinheiro parado", "orcamento queimado", "oportunidade".
- Evite jargão solto (CPM, CTR, frequency) sem traduzir. Se precisar citar, explique em 1 frase o que isso significa pro bolso.
- Crie urgência responsável: mostre o que está sendo deixado de ganhar ou desperdiçado AGORA, com estimativa baseada nos dados reais. Nunca invente números fora do META_CONTEXT; se for projeção, diga "estimativa".

FORMATO DA RESPOSTA (obrigatório):
1) Comece com ## Em 10 segundos (3–5 bullets em linguagem de cliente).
2) Separe com uma linha só com ---
3) Depois a análise completa (## Evidências, ## O que fazer agora) em Markdown limpo: tabelas GFM, bullets, títulos curtos. Sem HTML cru.
4) Quando houver oportunidade/perda clara, emita TAMBÉM o bloco:
<money_left>
{"amount_brl":1200,"period":"mês","reason":"frase curta em português do que está na mesa","urgency":"alta","action_hint":"próximo passo em 1 frase"}
</money_left>
urgency: alta | media | baixa. amount_brl = estimativa mensal do que deixa de ganhar OU do desperdício (deixe null se não der para estimar).

Também: análise mensal, comparação de campanhas, WEB_SEARCH com citações quando disponível.

PROPOSTAS AUTOMÁTICAS (quando houver ação clara e IDs reais no META_CONTEXT):
<propose_action>
{"action_type":"pause_ad","tool_name":"meta.pause_ad","title":"Pausar anúncio X","explanation":"...","rationale":"...","estimated_impact":"...","proposed_arguments":{"ad_id":"123","ad_name":"..."},"current_state":{"status":"ACTIVE"},"proposed_state":{"status":"PAUSED"}}
</propose_action>
Tools: meta.pause_ad, meta.pause_adset, meta.pause_campaign, meta.budget_change.
NÃO invente IDs. Máximo 3 propostas.`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function normalizeModelList(raw: any): { id: string; name: string; owned_by?: string }[] {
  const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.models) ? raw.models : Array.isArray(raw) ? raw : [];
  return arr
    .map((m: any) => {
      if (typeof m === "string") return { id: m, name: m };
      const id = String(m?.id ?? m?.model ?? m?.name ?? "");
      if (!id) return null;
      return { id, name: String(m?.name ?? id), owned_by: m?.owned_by ?? m?.provider };
    })
    .filter(Boolean) as { id: string; name: string; owned_by?: string }[];
}

async function fetchNanoModels(apiKey: string, path: string) {
  const res = await fetch(`${NANO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return normalizeModelList(JSON.parse(raw));
}

async function callText(
  apiKey: string,
  messages: ChatMessage[],
  model: string,
  extraSystem?: string,
  basePrompt: string = SYSTEM_PROMPT,
) {
  const system = extraSystem ? `${basePrompt}\n\n${extraSystem}` : basePrompt;
  const res = await fetch(`${NANO_BASE}/api/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      stream: false,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("NanoGPT text error", res.status, raw);
    throw new Error(`Text model failed (${res.status})`);
  }
  return (JSON.parse(raw)?.choices?.[0]?.message?.content ?? "") as string;
}

async function callImage(apiKey: string, prompt: string, model: string, size: string) {
  const res = await fetch(`${NANO_BASE}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size, response_format: "url" }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("NanoGPT image error", res.status, raw);
    throw new Error(`Image failed (${res.status})`);
  }
  const entry = JSON.parse(raw)?.data?.[0] ?? {};
  if (entry.url) return entry.url as string;
  if (entry.b64_json) return `data:image/png;base64,${entry.b64_json}`;
  throw new Error("Image response missing url/b64_json");
}

async function callImagePair(apiKey: string, prompt: string, model: string) {
  const [square, vertical] = await Promise.all([
    callImage(apiKey, `${prompt}\n\nFormat: 1:1 square feed ad`, model, "1024x1024").catch((e) => ({ error: e.message })),
    callImage(apiKey, `${prompt}\n\nFormat: 9:16 vertical story/reel ad`, model, "1024x1792").catch((e) => ({ error: e.message })),
  ]);
  const out: { url: string; format: string; label: string }[] = [];
  if (typeof square === "string") out.push({ url: square, format: "1:1", label: "Feed 1:1" });
  if (typeof vertical === "string") out.push({ url: vertical, format: "9:16", label: "Story 9:16" });
  if (!out.length) throw new Error("Falha nas duas variantes de imagem");
  return out;
}

// -------- NanoGPT async video (submit only — no polling here) --------

async function submitVideoJob(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${NANO_BASE}/api/generate-video`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("submit video failed", res.status, raw);
    throw new Error(`Video submit failed (${res.status}): ${raw.slice(0, 300)}`);
  }
  const json = JSON.parse(raw);
  const runId = json?.runId ?? json?.id ?? json?.data?.runId;
  if (!runId) throw new Error(`Video submit sem runId: ${raw.slice(0, 200)}`);
  return runId as string;
}

async function submitVideo(
  apiKey: string,
  model: string,
  prompt: string,
  opts: { imageUrl?: string; aspect_ratio?: string; duration?: string; resolution?: string } = {},
): Promise<{ runId: string; model: string; prompt: string }> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    aspect_ratio: opts.aspect_ratio ?? "9:16",
    duration: opts.duration ?? "5",
    resolution: opts.resolution ?? "1080p",
  };
  if (opts.imageUrl) body.imageUrl = opts.imageUrl;
  const runId = await submitVideoJob(apiKey, body);
  console.log("video job submitted", runId, model);
  return { runId, model, prompt };
}

// -------- Tag parsing --------

const IMG_RE = /<generate_image>([\s\S]*?)<\/generate_image>/i;
const VID_RE = /<generate_video>([\s\S]*?)<\/generate_video>/i;
const AD_VID_RE = /<generate_ad_video>([\s\S]*?)<\/generate_ad_video>/i;

function extractTag(text: string, tag: "generate_image" | "generate_video" | "generate_ad_video") {
  const closed = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const closedMatch = text.match(closed);
  if (closedMatch) {
    return { block: closedMatch[1].trim(), cleaned: text.replace(closed, "").trim() };
  }

  // Some models occasionally emit an opening tag and forget the closing tag.
  // Treat the rest of the message as the generation prompt so raw tags never leak to the UI.
  const open = new RegExp(`<${tag}>([\\s\\S]*)$`, "i");
  const openMatch = text.match(open);
  if (openMatch) {
    return { block: openMatch[1].trim(), cleaned: text.replace(open, "").trim() };
  }

  return null;
}

function parseAdVideoBlock(block: string): { script: string; visual: string } {
  const scriptM = block.match(/SCRIPT:\s*([\s\S]*?)(?:\|\||$)/i);
  const visualM = block.match(/VISUAL:\s*([\s\S]*)/i);
  return {
    script: (scriptM?.[1] ?? "").trim(),
    visual: (visualM?.[1] ?? block).trim(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("NANOGPT_API_KEY");
    if (!apiKey) throw new Error("NANOGPT_API_KEY não configurada");

    const body = await req.json();

    // ---- List models from NanoGPT (used by AI settings) ----
    if (body?.action === "list_models") {
      const type = String(body?.type || "all").toLowerCase();
      const models: Record<string, { id: string; name: string; owned_by?: string }[]> = {};
      if (type === "text" || type === "all") {
        models.text = await fetchNanoModels(apiKey, "/api/v1/models?detailed=true");
      }
      if (type === "image" || type === "all") {
        models.image = await fetchNanoModels(apiKey, "/api/v1/image-models?detailed=true").catch(async () => {
          const all = await fetchNanoModels(apiKey, "/api/v1/models?detailed=true");
          return all.filter((m) => /image|flux|dall|banana|sdxl|gpt-image/i.test(m.id));
        });
      }
      if (type === "video" || type === "all") {
        models.video = await fetchNanoModels(apiKey, "/api/v1/video-models?detailed=true").catch(async () => {
          const all = await fetchNanoModels(apiKey, "/api/v1/models?detailed=true");
          return all.filter((m) => /video|veo|kling|runway|seedance|happyhorse|omni/i.test(m.id));
        });
      }
      return json({ models, provider: "nanogpt", fetched_at: new Date().toISOString() });
    }

    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const textModel: string = body?.textModel || DEFAULT_TEXT_MODEL;
    const imageModel: string = body?.imageModel || DEFAULT_IMAGE_MODEL;
    const videoModel: string = body?.videoModel || DEFAULT_VIDEO_MODEL;
    const mode: "auto" | "image" | "video" | "ad_video" = body?.mode || "auto";
    const role: string = body?.role || body?.metaContext?.role || "creative_suite";
    const isTrafficManager = role === "traffic_manager";
    const deferMedia: boolean = !!body?.deferMedia;
    const useBrandLogo: boolean = !!body?.useBrandLogo;
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];
    const metaContext = body?.metaContext ?? null;

    const contextBits: string[] = [];
    if (useBrandLogo && !isTrafficManager)
      contextBits.push(
        "The user attached a brand logo — feature it prominently in every generated visual when creating creatives.",
      );
    if (attachments.length && !isTrafficManager)
      contextBits.push(`The user attached ${attachments.length} reference image(s). Match their style, subject and framing.`);
    if (metaContext) {
      const s = metaContext.summary
        ? Object.entries(metaContext.summary)
            .map(([k, v]) => `${k}=${v === null ? "n/d" : v}`)
            .join(", ")
        : "sem dados";
      const camps = Array.isArray(metaContext.campaigns)
        ? metaContext.campaigns
            .slice(0, 20)
            .map((c: any) => `${c.name}|spend=${c.spend}|leads=${c.leads}|cpl=${c.cpl ?? "n/d"}|cpm=${c.cpm ?? "n/d"}|ctr=${c.ctr ?? "n/d"}|status=${c.status}`)
            .join(" || ")
        : "";
      const sel = metaContext.selected_campaign
        ? JSON.stringify(metaContext.selected_campaign).slice(0, 4000)
        : "nenhuma";
      contextBits.push(
        `META_CONTEXT (dados reais — NÃO invente números): connected=${metaContext.connected}, account=${metaContext.ad_account_name ?? "n/a"} (${metaContext.ad_account_id ?? "n/a"}), currency=${metaContext.currency ?? "n/a"}, period=${metaContext.period ? `${metaContext.period.from}..${metaContext.period.to}` : "n/a"}, summary=[${s}]. campaigns=[${camps || "n/a"}]. selected_campaign=${sel}. ${metaContext.guidance ?? ""}`,
      );
    }
    const extraSystem = contextBits.join(" ");
    const basePrompt = isTrafficManager ? TRAFFIC_MANAGER_PROMPT : SYSTEM_PROMPT;

    const phases: { label: string; agent: string }[] = [];

    // Traffic manager: analysis + optional web search + proposals + memory
    if (isTrafficManager) {
      if (!messages.length) throw new Error("Missing messages");

      const orgId = String(body?.organization_id || metaContext?.organization_id || "");
      const campaignExternalId =
        body?.campaign_external_id !== undefined
          ? body.campaign_external_id
          : metaContext?.selected_campaign?.id ?? null;
      const campaignName =
        String(body?.campaign_name || metaContext?.selected_campaign?.name || "").slice(0, 200) ||
        null;
      const adAccountAssetId =
        body?.ad_account_asset_id || metaContext?.ad_account_asset_id || null;

      const auth = await requireUser(req);
      if (auth instanceof Response) return auth;
      if (orgId) {
        const gate = await requireOrgMember(auth, orgId);
        if (gate !== true) return gate;
      }

      const tmBits = [...contextBits];

      // Memory (last turns for this campaign / account)
      if (orgId) {
        let memQ = auth.adminClient
          .from("traffic_manager_memories")
          .select("role, content, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(12);
        if (campaignExternalId) {
          memQ = memQ.eq("campaign_external_id", String(campaignExternalId));
        } else {
          memQ = memQ.is("campaign_external_id", null);
        }
        const { data: memRows } = await memQ;
        if (memRows?.length) {
          const chronological = [...memRows].reverse();
          tmBits.push(
            "MEMORY (conversas anteriores nesta campanha/conta — use como continuidade):\n" +
              chronological
                .map((r: any) => `${r.role}: ${String(r.content).slice(0, 500)}`)
                .join("\n"),
          );
        }
      }

      if (Array.isArray(metaContext?.compare_campaigns) && metaContext.compare_campaigns.length) {
        tmBits.push(
          "compare_campaigns=" +
            JSON.stringify(metaContext.compare_campaigns).slice(0, 6000),
        );
      }

      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const lastUserText = lastUser?.content ?? "";
      let searchPayload: Awaited<ReturnType<typeof webSearch>> | null = null;
      if (shouldWebSearch(lastUserText, !!body?.enableSearch)) {
        phases.push({ label: "Pesquisando mercado / concorrência", agent: "researcher" });
        const query =
          String(body?.searchQuery || "").trim() ||
          `${lastUserText.slice(0, 200)} Meta Ads tráfego pago Brasil`;
        searchPayload = await webSearch(query, { maxResults: 5, apiKey });
        tmBits.push(formatSearchForPrompt(searchPayload));
      }

      phases.push({ label: "Gerente de Tráfego analisando dados", agent: "media_buyer" });
      const tmSystem = tmBits.join("\n\n");
      let text = await callText(apiKey, messages, textModel, tmSystem, basePrompt);
      text = text
        .replace(/<\/?generate_image>[\s\S]*?(<\/generate_image>|$)/gi, "")
        .replace(/<\/?generate_video>[\s\S]*?(<\/generate_video>|$)/gi, "")
        .replace(/<\/?generate_ad_video>[\s\S]*?(<\/generate_ad_video>|$)/gi, "")
        .trim();

      const { actions, cleaned } = extractProposeActions(text);
      text = cleaned;

      // Business urgency card: <money_left>{...}</money_left>
      let moneyLeft: Record<string, unknown> | null = null;
      const moneyMatch = text.match(/<money_left>([\s\S]*?)<\/money_left>/i);
      if (moneyMatch) {
        try {
          const raw = JSON.parse(moneyMatch[1].trim());
          const urg = String(raw.urgency || "media").toLowerCase();
          moneyLeft = {
            amount_brl: raw.amount_brl ?? raw.amountBrl ?? null,
            period: raw.period || "mês",
            reason: String(raw.reason || "").slice(0, 400),
            urgency: urg.startsWith("alt") ? "alta" : urg.startsWith("baix") ? "baixa" : "media",
            action_hint: raw.action_hint || raw.actionHint || null,
          };
        } catch {
          moneyLeft = null;
        }
        text = text.replace(/<money_left>[\s\S]*?<\/money_left>/i, "").trim();
      }

      let proposals: { id: string; title: string; tool_name: string; action_type: string }[] = [];
      if (orgId && actions.length) {
        phases.push({ label: "Registrando propostas para aprovação", agent: "media_buyer" });
        proposals = await insertProposals(auth.adminClient, {
          organizationId: orgId,
          userId: auth.userId,
          adAccountAssetId,
          actions,
          agent: "traffic_manager",
        });
        if (proposals.length) {
          text +=
            `\n\n---\n**${proposals.length} proposta(s)** enviada(s) para Aprovações: ` +
            proposals.map((p) => p.title).join("; ") +
            ".";
        }
      }

      // Persist memory turns
      if (orgId && lastUserText) {
        const proposalIds = proposals.map((p) => p.id);
        const sources = searchPayload?.results ?? [];
        await auth.adminClient.from("traffic_manager_memories").insert([
          {
            organization_id: orgId,
            user_id: auth.userId,
            campaign_external_id: campaignExternalId ? String(campaignExternalId) : null,
            campaign_name: campaignName,
            role: "user",
            content: lastUserText.slice(0, 8000),
            sources: [],
            proposal_ids: [],
          },
          {
            organization_id: orgId,
            user_id: auth.userId,
            campaign_external_id: campaignExternalId ? String(campaignExternalId) : null,
            campaign_name: campaignName,
            role: "assistant",
            content: text.slice(0, 12000),
            sources,
            proposal_ids: proposalIds,
          },
        ]);
      }

      return json({
        text,
        textModel,
        phases,
        role: "traffic_manager",
        proposals,
        moneyLeft,
        search: searchPayload
          ? {
              provider: searchPayload.provider,
              query: searchPayload.query,
              results: searchPayload.results,
              answer: searchPayload.answer,
              error: searchPayload.error,
            }
          : null,
      });
    }

    // Direct visual modes
    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = body?.prompt || lastUser?.content || "";
      if (!prompt) throw new Error("Missing image prompt");
      phases.push({ label: "Diretor de Arte compondo variantes", agent: "creative_director" });
      const images = await callImagePair(apiKey, [prompt, extraSystem].filter(Boolean).join("\n\n"), imageModel);
      return json({ text: "", images, textModel, imageModel, phases });
    }

    if (mode === "video") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = body?.prompt || lastUser?.content || "";
      if (!prompt) throw new Error("Missing video prompt");
      phases.push({ label: `Enviando job para ${videoModel}`, agent: "creative_director" });
      const videoJob = await submitVideo(apiKey, videoModel, [prompt, extraSystem].filter(Boolean).join("\n\n"));
      return json({ text: "", videoJob, textModel, videoModel, phases });
    }

    if (mode === "ad_video") {
      const prompt = String(body?.prompt || "").trim();
      const script = String(body?.script || "").trim();
      const visual = String(body?.visual || prompt).trim();
      if (!visual) throw new Error("Missing ad video visual prompt");

      phases.push({ label: "Diretor de Arte gerando frame-âncora 9:16", agent: "creative_director" });
      const heroImageUrl = await callImage(
        apiKey,
        `${[visual, extraSystem].filter(Boolean).join("\n\n")}\n\nFormat: 9:16 vertical hero frame for a video ad — clean composition, strong subject, dramatic lighting`,
        imageModel,
        "1024x1792",
      );
      phases.push({ label: `Enviando image-to-video ao ${videoModel}`, agent: "creative_director" });
      const motionPrompt = script
        ? `Ad video visualizing this narration: "${script}". Motion: subtle camera push-in, natural movement, cinematic. ${visual}`
        : visual;
      const videoJob = await submitVideo(apiKey, videoModel, motionPrompt, {
        imageUrl: heroImageUrl,
        aspect_ratio: "9:16",
        duration: "5",
      });
      return json({
        text: script ? `**🎬 Roteiro / Narração:**\n\n> ${script.replace(/\n/g, "\n> ")}` : "",
        images: [{ url: heroImageUrl, format: "9:16", label: "Frame-âncora 9:16" }],
        videoJob,
        script,
        textModel,
        imageModel,
        videoModel,
        phases,
      });
    }

    if (!messages.length) throw new Error("Missing messages");

    phases.push({ label: `Diretor de Marketing consultando ${textModel}`, agent: "director" });
    const rawText = await callText(apiKey, messages, textModel, extraSystem);

    let cleanedText = rawText;
    let images: { url: string; format: string; label: string }[] | undefined;
    let videoJob: { runId: string; model: string; prompt: string } | undefined;
    let heroImageUrl: string | undefined;
    let script: string | undefined;

    if (deferMedia) {
      const adMatch = extractTag(rawText, "generate_ad_video");
      if (adMatch) {
        cleanedText = adMatch.cleaned;
        const parsed = parseAdVideoBlock(adMatch.block);
        script = parsed.script;
        if (script) cleanedText = `**🎬 Roteiro / Narração:**\n\n> ${script.replace(/\n/g, "\n> ")}\n\n${cleanedText}`;
        return json({
          text: cleanedText,
          mediaRequest: { type: "ad_video", script: parsed.script, visual: parsed.visual },
          textModel,
          imageModel,
          videoModel,
          phases: [
            ...phases,
            { label: "Roteirista estruturou o vídeo", agent: "copywriter" },
            { label: "Frame e render serão executados em job assíncrono", agent: "creative_director" },
          ],
        });
      }

      const imgMatch = extractTag(rawText, "generate_image");
      if (imgMatch) {
        cleanedText = imgMatch.cleaned;
        return json({
          text: cleanedText,
          mediaRequest: { type: "image", prompt: imgMatch.block },
          textModel,
          imageModel,
          videoModel,
          phases: [...phases, { label: "Diretor de Arte recebeu briefing visual", agent: "creative_director" }],
        });
      }

      const vidMatch = extractTag(rawText, "generate_video");
      if (vidMatch) {
        cleanedText = vidMatch.cleaned;
        return json({
          text: cleanedText,
          mediaRequest: { type: "video", prompt: vidMatch.block },
          textModel,
          imageModel,
          videoModel,
          phases: [...phases, { label: "Job de vídeo será enviado em segundo plano", agent: "creative_director" }],
        });
      }
    }

    // 1) Full ad-video flow: image + image-to-video submit (async)
    const adMatch = rawText.match(AD_VID_RE);
    if (adMatch) {
      cleanedText = cleanedText.replace(AD_VID_RE, "").trim();
      const { script: s, visual } = parseAdVideoBlock(adMatch[1]);
      script = s;
      const visualPrompt = [visual, extraSystem].filter(Boolean).join("\n\n");
      phases.push({ label: "Diretor de Arte gerando frame-âncora 9:16", agent: "creative_director" });
      try {
        heroImageUrl = await callImage(
          apiKey,
          `${visualPrompt}\n\nFormat: 9:16 vertical hero frame for a video ad — clean composition, strong subject, dramatic lighting`,
          imageModel,
          "1024x1792",
        );
      } catch (err) {
        cleanedText += `\n\n_⚠️ Falha ao gerar frame-âncora: ${(err as Error).message}_`;
      }
      if (heroImageUrl) {
        phases.push({ label: `Enviando image-to-video ao ${videoModel}`, agent: "creative_director" });
        try {
          const motionPrompt = script
            ? `Ad video visualizing this narration: "${script}". Motion: subtle camera push-in, natural movement, cinematic. ${visual}`
            : visual;
          videoJob = await submitVideo(apiKey, videoModel, motionPrompt, {
            imageUrl: heroImageUrl,
            aspect_ratio: "9:16",
            duration: "5",
          });
        } catch (err) {
          cleanedText += `\n\n_⚠️ Falha ao enviar vídeo: ${(err as Error).message}_`;
        }
      }
      if (script) cleanedText = `**🎬 Roteiro / Narração:**\n\n> ${script.replace(/\n/g, "\n> ")}\n\n${cleanedText}`;
    }

    // 2) Simple image request
    const imgMatch = rawText.match(IMG_RE);
    if (imgMatch && !images) {
      cleanedText = cleanedText.replace(IMG_RE, "").trim();
      const imgPrompt = [imgMatch[1].trim(), extraSystem].filter(Boolean).join("\n\n");
      phases.push({ label: "Diretor de Arte gerando 1:1 e 9:16", agent: "creative_director" });
      try {
        images = await callImagePair(apiKey, imgPrompt, imageModel);
      } catch (err) {
        cleanedText += `\n\n_⚠️ Falha ao gerar imagem: ${(err as Error).message}_`;
      }
    }

    // 3) Simple text-to-video request (async)
    const vidMatch = rawText.match(VID_RE);
    if (vidMatch && !videoJob) {
      cleanedText = cleanedText.replace(VID_RE, "").trim();
      const vPrompt = [vidMatch[1].trim(), extraSystem].filter(Boolean).join("\n\n");
      phases.push({ label: `Enviando text-to-video ao ${videoModel}`, agent: "creative_director" });
      try {
        videoJob = await submitVideo(apiKey, videoModel, vPrompt);
      } catch (err) {
        cleanedText += `\n\n_⚠️ Falha ao enviar vídeo: ${(err as Error).message}_`;
      }
    }

    const responseImages =
      images ??
      (heroImageUrl ? [{ url: heroImageUrl, format: "9:16", label: "Frame-âncora 9:16" }] : undefined);

    return json({
      text: cleanedText,
      images: responseImages,
      videoJob,
      script,
      textModel,
      imageModel,
      videoModel,
      phases,
    });
  } catch (err) {
    console.error("nanogpt-chat error", err);
    return json({ error: (err as Error).message }, { status: 500 });
  }
});
