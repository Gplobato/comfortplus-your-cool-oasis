const BUCKET = "creative-assets";
const MAX_BYTES = 100 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export type StoredMedia = {
  url: string;
  storage_path: string;
  mime_type: string;
};

function extensionFor(contentType: string, kind: "image" | "video") {
  const normalized = contentType.toLowerCase().split(";")[0];
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return known[normalized] ?? (kind === "image" ? "png" : "mp4");
}

async function readMedia(source: string, kind: "image" | "video") {
  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error("Data URL de mídia inválida");
    const binary = atob(match[2]);
    if (binary.length > MAX_BYTES) throw new Error("Mídia excede 100 MB");
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { bytes, contentType: match[1] };
  }

  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Download da mídia falhou (${response.status})`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) throw new Error("Mídia excede 100 MB");
  const contentType = response.headers.get("content-type")?.split(";")[0] ||
    (kind === "image" ? "image/png" : "video/mp4");
  if (!contentType.startsWith(`${kind}/`)) {
    throw new Error(`Resposta não é ${kind}: ${contentType}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Mídia vazia ou grande demais");
  return { bytes, contentType };
}

export async function persistGeneratedMedia(
  adminClient: any,
  organizationId: string,
  source: string,
  kind: "image" | "video",
  stableKey?: string,
): Promise<StoredMedia> {
  const { bytes, contentType } = await readMedia(source, kind);
  const extension = extensionFor(contentType, kind);
  const safeKey = String(stableKey || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "-");
  const storagePath = `${organizationId}/ai/${kind}/${safeKey}.${extension}`;
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
  if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

  const { data, error: signedError } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signedError || !data?.signedUrl) {
    throw new Error(`URL assinada: ${signedError?.message ?? "não gerada"}`);
  }
  return { url: data.signedUrl, storage_path: storagePath, mime_type: contentType };
}
