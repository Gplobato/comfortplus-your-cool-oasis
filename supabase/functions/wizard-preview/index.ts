import { createClient } from "npm:@supabase/supabase-js@2";

const NANO_BASE = "https://nano-gpt.com";
const DEFAULT_TEXT_MODEL = "zai-org/glm-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DAY_MS = 86_400_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Answers = {
  businessName: string;
  niche: string;
  offer: string;
  differentiator: string;
  audience: string;
  pain: string;
  objective: "leads" | "sales" | "whatsapp" | "awareness";
  style: "premium" | "direct" | "ugc" | "minimal";
  format: "feed" | "story";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseAnswers(raw: unknown): Answers | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  const answers = {
    businessName: clean(input.businessName, 80),
    niche: clean(input.niche, 100),
    offer: clean(input.offer, 220),
    differentiator: clean(input.differentiator, 220),
    audience: clean(input.audience, 180),
    pain: clean(input.pain, 220),
    objective: clean(input.objective, 20),
    style: clean(input.style, 20),
    format: clean(input.format, 20),
  };
  if (
    !answers.businessName ||
    !answers.niche ||
    !answers.offer ||
    !answers.audience ||
    !["leads", "sales", "whatsapp", "awareness"].includes(answers.objective) ||
    !["premium", "direct", "ugc", "minimal"].includes(answers.style) ||
    !["feed", "story"].includes(answers.format)
  ) return null;
  return answers as Answers;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function buildCreative(apiKey: string, answers: Answers) {
  const objectiveLabels = {
    leads: "gerar leads",
    sales: "vender agora",
    whatsapp: "iniciar conversas no WhatsApp",
    awareness: "aumentar reconhecimento da marca",
  };
  const styleLabels = {
    premium: "premium, sofisticado, editorial",
    direct: "direto, contrastado, orientado à conversão",
    ugc: "autêntico, humano, estilo conteúdo de cliente",
    minimal: "minimalista, limpo, muito espaço negativo",
  };
  const brief = `
Marca: ${answers.businessName}
Nicho: ${answers.niche}
Oferta: ${answers.offer}
Diferencial: ${answers.differentiator || "não informado"}
Público: ${answers.audience}
Dor/desejo: ${answers.pain || "não informado"}
Objetivo: ${objectiveLabels[answers.objective]}
Direção visual: ${styleLabels[answers.style]}
Formato: ${answers.format === "story" ? "vertical 9:16" : "quadrado 1:1"}
`.trim();

  const system = `Você é um diretor de criação especializado em anúncios de resposta direta para Meta Ads.
Retorne SOMENTE JSON válido com:
{"headline":"máximo 7 palavras em pt-BR","primary_text":"copy de 2 a 3 frases em pt-BR","cta":"CTA curto em pt-BR","visual_prompt":"prompt detalhado em inglês para gerar a peça final"}
O visual_prompt deve produzir um anúncio pronto, profissional e crível, com hierarquia clara, fotografia publicitária e o headline exato legível na arte. Não invente preço, desconto ou promessa.`;

  let creative: {
    headline: string;
    primary_text: string;
    cta: string;
    visual_prompt: string;
  } | null = null;

  try {
    const textResponse = await fetch(`${NANO_BASE}/api/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("WIZARD_TEXT_MODEL") || DEFAULT_TEXT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: brief },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const raw = await textResponse.text();
    if (textResponse.ok) {
      const content = JSON.parse(raw)?.choices?.[0]?.message?.content ?? "";
      creative = JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, ""));
    }
  } catch {
    // Deterministic fallback still allows the image preview to complete.
  }

  const headline = clean(creative?.headline || answers.offer, 70);
  const primaryText = clean(
    creative?.primary_text ||
      `${answers.offer}. Uma solução pensada para ${answers.audience}. ${answers.differentiator}`,
    360,
  );
  const cta = clean(
    creative?.cta || (answers.objective === "whatsapp" ? "Fale conosco" : "Saiba mais"),
    40,
  );
  const visualPrompt = clean(
    creative?.visual_prompt ||
      `Professional ${styleLabels[answers.style]} Meta Ads creative for a ${answers.niche} business named ${answers.businessName}. Offer: ${answers.offer}. Audience: ${answers.audience}. Include the exact Portuguese headline "${headline}" with clean, highly legible typography. Brand-safe composition, polished commercial lighting, no fake price, no watermark.`,
    1800,
  );

  const size = answers.format === "story" ? "1024x1792" : "1024x1024";
  const imageResponse = await fetch(`${NANO_BASE}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("WIZARD_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL,
      prompt: `${visualPrompt}\n\nOutput format: ${answers.format === "story" ? "9:16 vertical Story/Reel ad" : "1:1 square Feed ad"}.`,
      n: 1,
      size,
      response_format: "url",
    }),
    signal: AbortSignal.timeout(95_000),
  });
  const imageRaw = await imageResponse.text();
  if (!imageResponse.ok) throw new Error(`image_generation_${imageResponse.status}`);
  const entry = JSON.parse(imageRaw)?.data?.[0] ?? {};
  const imageUrl = entry.url ||
    (entry.b64_json ? `data:image/png;base64,${entry.b64_json}` : null);
  if (!imageUrl) throw new Error("image_url_missing");

  return { headline, primary_text: primaryText, cta, prompt: visualPrompt, image_url: imageUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const nanoKey = Deno.env.get("NANOGPT_API_KEY") ?? "";
  const rateSecret = Deno.env.get("WIZARD_RATE_LIMIT_SECRET") ||
    Deno.env.get("META_OAUTH_STATE_SECRET") || serviceKey;
  if (!url || !serviceKey || !rateSecret) return json({ error: "wizard_not_configured" }, 503);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = clean(body.action || "generate", 20);

  if (action === "waitlist") {
    const email = clean(body.email, 180).toLowerCase();
    if (!validEmail(email)) return json({ error: "invalid_email" }, 400);
    const lead = {
      email,
      name: clean(body.name, 100) || null,
      whatsapp: clean(body.whatsapp, 40) || null,
      source: "wizard",
      intent: clean(body.intent || "pricing", 40),
      answers: parseAnswers(body.answers) ?? {},
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("wizard_waitlist_leads").insert(lead);
    if (error?.code === "23505") {
      await admin.from("wizard_waitlist_leads").update(lead).eq("email", email);
    } else if (error) {
      return json({ error: "waitlist_save_failed" }, 500);
    }
    return json({ ok: true });
  }

  if (!nanoKey) return json({ error: "generation_not_configured" }, 503);
  const deviceId = clean(body.device_id, 100);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(deviceId)) {
    return json({ error: "invalid_device" }, 400);
  }
  const answers = parseAnswers(body.answers);
  if (!answers) return json({ error: "invalid_answers" }, 400);

  const ip = requestIp(req) || `unknown:${deviceId}`;
  const [deviceHash, ipHash] = await Promise.all([
    sha256(`${rateSecret}:device:${deviceId}`),
    sha256(`${rateSecret}:ip:${ip}`),
  ]);

  const { data: existing } = await admin
    .from("wizard_preview_requests")
    .select("id,status,attempts,headline,primary_text,cta,result_url,created_at")
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (existing?.status === "completed" && existing.result_url) {
    return json({
      cached: true,
      preview: {
        image_url: existing.result_url,
        headline: existing.headline,
        primary_text: existing.primary_text,
        cta: existing.cta,
      },
    });
  }
  if (existing?.status === "processing") {
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age < 5 * 60_000) return json({ error: "generation_in_progress" }, 409);
  }
  if (existing && existing.attempts >= 2) {
    return json({ error: "preview_already_used" }, 429);
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count: ipCount } = await admin
    .from("wizard_preview_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((ipCount ?? 0) >= 3) return json({ error: "ip_preview_limit" }, 429);

  let requestId = existing?.id as string | undefined;
  if (existing) {
    const { error } = await admin
      .from("wizard_preview_requests")
      .update({
        status: "processing",
        attempts: existing.attempts + 1,
        answers,
        error_code: null,
        created_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return json({ error: "preview_reservation_failed" }, 409);
  } else {
    const { data, error } = await admin
      .from("wizard_preview_requests")
      .insert({ device_hash: deviceHash, ip_hash: ipHash, answers })
      .select("id")
      .single();
    if (error || !data) return json({ error: "preview_reservation_failed" }, 409);
    requestId = data.id;
  }

  try {
    const result = await buildCreative(nanoKey, answers);
    await admin
      .from("wizard_preview_requests")
      .update({
        status: "completed",
        prompt: result.prompt,
        headline: result.headline,
        primary_text: result.primary_text,
        cta: result.cta,
        result_url: result.image_url,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    return json({ cached: false, preview: result });
  } catch (error) {
    const code = clean(error instanceof Error ? error.message : error, 120);
    await admin
      .from("wizard_preview_requests")
      .update({ status: "failed", error_code: code })
      .eq("id", requestId);
    return json({ error: "generation_failed", detail: code }, 502);
  }
});
