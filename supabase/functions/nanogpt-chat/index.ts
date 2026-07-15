// NanoGPT multi-agent chat.
// - Text model (default zai-org/glm-5.2) can emit <generate_image>PROMPT</generate_image>
//   or <generate_video>PROMPT</generate_video> to hand off to the visual agents.
// - Image mode always renders TWO variants (1:1 and 9:16) — Facebook Ads standard.
// - Optionally embeds a brand logo reference and user-attached images into the prompt.
// - Video mode calls the NanoGPT video endpoint (best-effort).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NANO_BASE = "https://nano-gpt.com";
const DEFAULT_TEXT_MODEL = "zai-org/glm-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_VIDEO_MODEL = "veo-3";

const SYSTEM_PROMPT = `Você é o ProAds Assistant, um time coordenado de agentes de marketing digital dentro de uma plataforma SaaS.
Papéis do time: Diretor de Marketing, Pesquisador, Estrategista, Copywriter, Diretor de Arte, Media Buyer, Analista.

Regras:
- Responda sempre em português brasileiro, tom profissional e direto.
- Use markdown quando ajudar (listas, negrito, tabelas curtas).
- Se o usuário pedir para GERAR/CRIAR/DESENHAR uma imagem, um criativo visual, um anúncio em imagem ou um mockup, inclua na sua resposta a tag:
  <generate_image>DESCRIÇÃO DETALHADA EM INGLÊS</generate_image>
  A descrição deve ser rica (estilo, iluminação, composição, cores, produto). Serão geradas duas variantes automaticamente: 1:1 (feed) e 9:16 (stories/reels).
- Se o usuário pedir para GERAR/CRIAR um VÍDEO, um reel ou vídeo curto para anúncio, inclua:
  <generate_video>DESCRIÇÃO DETALHADA EM INGLÊS</generate_video>
- Se o usuário anexou uma LOGO da marca ou imagens de referência, mencione isso no prompt visual (ex: "featuring the attached brand logo prominently").
- NÃO use as tags se o usuário só quer conversar, analisar ou receber texto puro.`;

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
  const json = JSON.parse(raw);
  return (json?.choices?.[0]?.message?.content ?? "") as string;
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
  const json = JSON.parse(raw);
  const entry = json?.data?.[0] ?? {};
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

async function callVideo(apiKey: string, prompt: string, model: string) {
  const res = await fetch(`${NANO_BASE}/v1/videos/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, duration: 5, aspect_ratio: "9:16" }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("NanoGPT video error", res.status, raw);
    throw new Error(`Video failed (${res.status}): ${raw.slice(0, 200)}`);
  }
  const json = JSON.parse(raw);
  const url = json?.data?.[0]?.url ?? json?.url ?? json?.video_url;
  if (!url) throw new Error("Video response missing url");
  return url as string;
}

const IMG_RE = /<generate_image>([\s\S]*?)<\/generate_image>/i;
const VID_RE = /<generate_video>([\s\S]*?)<\/generate_video>/i;

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
    const mode: "auto" | "image" | "video" = body?.mode || "auto";
    const useBrandLogo: boolean = !!body?.useBrandLogo;
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];

    const contextBits: string[] = [];
    if (useBrandLogo) contextBits.push("The user has attached the OBRAS TIMELAPSE / MB GROUP brand logo — feature it prominently and consistently in every generated visual.");
    if (attachments.length) contextBits.push(`The user attached ${attachments.length} reference image(s). Match their style, subject and framing.`);
    const extraSystem = contextBits.join(" ");

    // Direct visual mode
    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = body?.prompt || lastUser?.content || "";
      if (!prompt) throw new Error("Missing image prompt");
      const fullPrompt = [prompt, extraSystem].filter(Boolean).join("\n\n");
      const images = await callImagePair(apiKey, fullPrompt, imageModel);
      return Response.json({ text: "", images, textModel, imageModel });
    }

    if (mode === "video") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = body?.prompt || lastUser?.content || "";
      if (!prompt) throw new Error("Missing video prompt");
      const url = await callVideo(apiKey, [prompt, extraSystem].filter(Boolean).join("\n\n"), videoModel);
      return Response.json({ text: "", videoUrl: url, textModel, videoModel });
    }

    if (!messages.length) throw new Error("Missing messages");

    const rawText = await callText(apiKey, messages, textModel, extraSystem);

    let cleanedText = rawText;
    let images: { url: string; format: string; label: string }[] | undefined;
    let videoUrl: string | undefined;

    const imgMatch = rawText.match(IMG_RE);
    if (imgMatch) {
      cleanedText = cleanedText.replace(IMG_RE, "").trim();
      const imgPrompt = [imgMatch[1].trim(), extraSystem].filter(Boolean).join("\n\n");
      try {
        images = await callImagePair(apiKey, imgPrompt, imageModel);
      } catch (err) {
        cleanedText += `\n\n_⚠️ Falha ao gerar imagem: ${(err as Error).message}_`;
      }
    }

    const vidMatch = rawText.match(VID_RE);
    if (vidMatch) {
      cleanedText = cleanedText.replace(VID_RE, "").trim();
      const vPrompt = [vidMatch[1].trim(), extraSystem].filter(Boolean).join("\n\n");
      try {
        videoUrl = await callVideo(apiKey, vPrompt, videoModel);
      } catch (err) {
        cleanedText += `\n\n_⚠️ Falha ao gerar vídeo: ${(err as Error).message}_`;
      }
    }

    return Response.json({ text: cleanedText, images, videoUrl, textModel, imageModel, videoModel });
  } catch (err) {
    console.error("nanogpt-chat error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
