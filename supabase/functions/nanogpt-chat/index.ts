// NanoGPT multi-agent chat for ProAds.
// Video generation is ASYNC: this function submits the job and returns { videoJob: { runId, model } }
// immediately. The client polls `nanogpt-video-status` until COMPLETED.

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
Cliente ativo: **Obras Timelapse (MB Group)** — monitoramento de obras via câmeras/timelapse com IA.

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
    VISUAL: [descrição em inglês do FRAME-CHAVE — cena, iluminação, marca Obras Timelapse visível]
    </generate_ad_video>
  Backend gera imagem-âncora e usa como base para vídeo (image-to-video, 9:16, 5s).
- Antes/depois das tags, explique a estratégia (público, ângulo, CTA) em bullets curtos.
- NÃO use as tags se o usuário só quer conversar.`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callText(apiKey: string, messages: ChatMessage[], model: string, extraSystem?: string) {
  const system = extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT;
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
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const textModel: string = body?.textModel || DEFAULT_TEXT_MODEL;
    const imageModel: string = body?.imageModel || DEFAULT_IMAGE_MODEL;
    const videoModel: string = body?.videoModel || DEFAULT_VIDEO_MODEL;
    const mode: "auto" | "image" | "video" | "ad_video" = body?.mode || "auto";
    const deferMedia: boolean = !!body?.deferMedia;
    const useBrandLogo: boolean = !!body?.useBrandLogo;
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];
    const metaContext = body?.metaContext ?? null;

    const contextBits: string[] = [];
    if (useBrandLogo)
      contextBits.push(
        "The user attached the OBRAS TIMELAPSE / MB GROUP brand logo — always feature it prominently in every generated visual.",
      );
    if (attachments.length)
      contextBits.push(`The user attached ${attachments.length} reference image(s). Match their style, subject and framing.`);
    if (metaContext) {
      const s = metaContext.summary
        ? Object.entries(metaContext.summary)
            .map(([k, v]) => `${k}=${v === null ? "n/d" : v}`)
            .join(", ")
        : "sem dados";
      contextBits.push(
        `META_CONTEXT (dados reais da Marketing API — NÃO invente números): connected=${metaContext.connected}, account=${metaContext.ad_account_name ?? "n/a"} (${metaContext.ad_account_id ?? "n/a"}), currency=${metaContext.currency ?? "n/a"}, period=${metaContext.period ? `${metaContext.period.from}..${metaContext.period.to}` : "n/a"}, summary=[${s}]. ${metaContext.guidance ?? ""} Se uma métrica for null/n/d, diga que está indisponível.`,
      );
    }
    const extraSystem = contextBits.join(" ");

    const phases: { label: string; agent: string }[] = [];

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
