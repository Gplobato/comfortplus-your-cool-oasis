// NanoGPT multi-agent chat: text (default zai-org/glm-5.2) + image (gpt-image-2).
// The text model can request an image mid-conversation by emitting
// <generate_image>PROMPT</generate_image>. The function will call the image
// endpoint and return both the cleaned text and the image URL/base64 so the
// same conversation thread can render text + image together.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NANO_BASE = "https://nano-gpt.com";
const DEFAULT_TEXT_MODEL = "zai-org/glm-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";

const SYSTEM_PROMPT = `Você é o ProAds Assistant, um time coordenado de agentes de marketing digital dentro de uma plataforma SaaS.
Você domina: estratégia de anúncios (Meta, Google, TikTok), criação de campanhas, copywriting, direção criativa, análise de dados e pesquisa de mercado.

Regras:
- Responda sempre em português brasileiro, tom profissional porém direto.
- Use markdown quando ajudar (listas, negrito, tabelas curtas).
- Você tem acesso a um agente de imagem separado. Sempre que o usuário pedir para GERAR/CRIAR/DESENHAR uma IMAGEM, um CRIATIVO visual, um ANÚNCIO em imagem, um MOCKUP ou algo similar, inclua em algum ponto da sua resposta a tag:
  <generate_image>DESCRIÇÃO_DETALHADA_EM_INGLÊS</generate_image>
- A descrição dentro da tag deve ser um prompt rico em inglês (estilo, iluminação, composição, formato) para o modelo de imagem.
- Você pode escrever texto antes e depois da tag explicando o criativo.
- NÃO use a tag se o usuário só quer conversar, analisar ou receber texto.
- Se o usuário pedir para EDITAR uma imagem que ele acabou de gerar, use a mesma tag com o novo prompt completo.`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callText(apiKey: string, messages: ChatMessage[], model: string) {
  const res = await fetch(`${NANO_BASE}/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: false,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("NanoGPT text error", res.status, raw);
    throw new Error(`Text model failed (${res.status}): ${raw.slice(0, 500)}`);
  }
  const json = JSON.parse(raw);
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return content;
}

async function callImage(apiKey: string, prompt: string, model: string) {
  const res = await fetch(`${NANO_BASE}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("NanoGPT image error", res.status, raw);
    throw new Error(`Image model failed (${res.status}): ${raw.slice(0, 500)}`);
  }
  const json = JSON.parse(raw);
  const entry = json?.data?.[0] ?? {};
  if (entry.url) return { url: entry.url as string };
  if (entry.b64_json) return { url: `data:image/png;base64,${entry.b64_json}` };
  throw new Error("Image response missing url/b64_json");
}

const IMAGE_TAG_RE = /<generate_image>([\s\S]*?)<\/generate_image>/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("NANOGPT_API_KEY");
    if (!apiKey) throw new Error("NANOGPT_API_KEY is not configured");

    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const textModel: string = body?.textModel || DEFAULT_TEXT_MODEL;
    const imageModel: string = body?.imageModel || DEFAULT_IMAGE_MODEL;
    const forceImage: boolean = body?.mode === "image";

    if (forceImage) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = body?.prompt || lastUser?.content || "";
      if (!prompt) throw new Error("Missing image prompt");
      const image = await callImage(apiKey, prompt, imageModel);
      return new Response(
        JSON.stringify({ text: "", image, textModel, imageModel }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!messages.length) throw new Error("Missing messages");

    const rawText = await callText(apiKey, messages, textModel);
    const match = rawText.match(IMAGE_TAG_RE);
    let image: { url: string } | null = null;
    let cleanedText = rawText;

    if (match) {
      const imgPrompt = match[1].trim();
      cleanedText = rawText.replace(IMAGE_TAG_RE, "").trim();
      try {
        image = await callImage(apiKey, imgPrompt, imageModel);
      } catch (err) {
        console.error("Image generation failed", err);
        cleanedText += `\n\n_⚠️ Não consegui gerar a imagem: ${(err as Error).message}_`;
      }
    }

    return new Response(
      JSON.stringify({
        text: cleanedText,
        image,
        textModel,
        imageModel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("nanogpt-chat error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
