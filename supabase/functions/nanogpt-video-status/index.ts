// Poll a NanoGPT video job. Called every few seconds by the client until COMPLETED/FAILED.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NANO_BASE = "https://nano-gpt.com";

function extractVideoUrl(j: any): string | undefined {
  return (
    j?.data?.output?.video?.url ??
    j?.data?.output?.url ??
    j?.data?.video?.url ??
    j?.output?.video?.url ??
    j?.data?.videoUrl ??
    j?.videoUrl
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("NANOGPT_API_KEY");
    if (!apiKey) throw new Error("NANOGPT_API_KEY não configurada");

    const { runId } = await req.json();
    if (!runId) throw new Error("runId obrigatório");

    const r = await fetch(
      `${NANO_BASE}/api/video/status?requestId=${encodeURIComponent(runId)}`,
      { headers: { "x-api-key": apiKey, Authorization: `Bearer ${apiKey}` } },
    );
    const raw = await r.text();
    if (!r.ok) {
      console.error("video status error", r.status, raw);
      return Response.json(
        { status: "error", error: `status ${r.status}: ${raw.slice(0, 200)}` },
        { headers: corsHeaders },
      );
    }

    const j = JSON.parse(raw);
    const rawStatus = String(j?.data?.status ?? j?.status ?? "").toUpperCase();
    const progress =
      typeof j?.data?.progress === "number"
        ? j.data.progress
        : typeof j?.progress === "number"
          ? j.progress
          : null;

    let status: "queued" | "processing" | "completed" | "failed";
    if (rawStatus === "COMPLETED" || rawStatus === "SUCCESS") status = "completed";
    else if (rawStatus === "FAILED" || rawStatus === "CANCELED" || rawStatus === "ERROR") status = "failed";
    else if (rawStatus === "PENDING" || rawStatus === "QUEUED") status = "queued";
    else status = "processing";

    const payload: Record<string, unknown> = { status, rawStatus, progress };
    if (status === "completed") {
      const url = extractVideoUrl(j);
      if (!url) {
        payload.status = "failed";
        payload.error = "Job completo mas sem URL de vídeo";
      } else {
        payload.videoUrl = url;
      }
    }
    if (status === "failed") {
      payload.error = j?.data?.userFriendlyError || j?.data?.error || j?.error || "Falha na geração";
    }

    return Response.json(payload, { headers: corsHeaders });
  } catch (err) {
    console.error("nanogpt-video-status error", err);
    return new Response(
      JSON.stringify({ status: "error", error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
