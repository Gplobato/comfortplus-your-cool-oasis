// List NanoGPT models by modality for AI settings UI.
// GET ?type=text|image|video|all
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const NANO_BASE = "https://nano-gpt.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeList(raw: any): { id: string; name: string; owned_by?: string }[] {
  const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.models) ? raw.models : Array.isArray(raw) ? raw : [];
  return arr
    .map((m: any) => {
      if (typeof m === "string") return { id: m, name: m };
      const id = String(m?.id ?? m?.model ?? m?.name ?? "");
      if (!id) return null;
      return {
        id,
        name: String(m?.name ?? m?.id ?? id),
        owned_by: m?.owned_by ?? m?.provider ?? undefined,
      };
    })
    .filter(Boolean) as { id: string; name: string; owned_by?: string }[];
}

async function fetchModels(apiKey: string, path: string) {
  const res = await fetch(`${NANO_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${raw.slice(0, 180)}`);
  try {
    return normalizeList(JSON.parse(raw));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("NANOGPT_API_KEY");
  if (!apiKey) return json({ error: "nanogpt_key_missing" }, 500);

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "all").toLowerCase();

  try {
    const out: Record<string, { id: string; name: string; owned_by?: string }[]> = {};

    if (type === "text" || type === "all") {
      out.text = await fetchModels(apiKey, "/api/v1/models?detailed=true");
    }
    if (type === "image" || type === "all") {
      out.image = await fetchModels(apiKey, "/api/v1/image-models?detailed=true").catch(async () => {
        // fallback: filter text catalog for image-ish ids
        const all = await fetchModels(apiKey, "/api/v1/models?detailed=true");
        return all.filter((m) => /image|flux|dall|banana|sdxl|gpt-image/i.test(m.id));
      });
    }
    if (type === "video" || type === "all") {
      out.video = await fetchModels(apiKey, "/api/v1/video-models?detailed=true").catch(async () => {
        const all = await fetchModels(apiKey, "/api/v1/models?detailed=true");
        return all.filter((m) => /video|veo|kling|runway|seedance|happyhorse|omni/i.test(m.id));
      });
    }

    return json({
      models: out,
      fetched_at: new Date().toISOString(),
      provider: "nanogpt",
    });
  } catch (e: any) {
    return json({ error: "models_fetch_failed", message: String(e?.message ?? e).slice(0, 300) }, 502);
  }
});
