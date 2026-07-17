import { supabase } from "@/integrations/supabase/client";

export const CREATIVE_BUCKET = "creative-assets";
const GALLERY_QUERY_TIMEOUT_MS = 12_000;
const SIGNED_URL_TIMEOUT_MS = 8_000;

export type OwnedCreative = {
  id: string;
  organization_id: string;
  name: string;
  source: "ai" | "upload";
  type: string | null;
  format: string | null;
  status: string | null;
  publication_status: "draft" | "ready" | "published" | "failed";
  thumbnail_url: string | null;
  media_url: string | null;
  signed_url?: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  destination_url: string | null;
  description: string | null;
  tags: string[];
  created_by_ai: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function sanitizeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function signedCreativeUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(CREATIVE_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function listOwnedCreatives(
  organizationId: string,
  includeArchived = false,
  signal?: AbortSignal,
) {
  let query = supabase
    .from("creatives" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .neq("source", "meta")
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.is("archived_at", null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(
    query,
    GALLERY_QUERY_TIMEOUT_MS,
    "A galeria demorou demais para responder. Tente novamente.",
  );
  if (error) throw error;

  const creatives = ((data ?? []) as unknown as OwnedCreative[]).map((creative) => ({
    ...creative,
    tags: creative.tags ?? [],
    signed_url: null,
  }));
  const paths = [...new Set(creatives.map((creative) => creative.storage_path).filter(Boolean))] as string[];
  if (!paths.length) return creatives;

  // Resolve all private assets in one request. Media URL failures must never
  // keep the entire gallery in a loading state.
  const signedResult = await withTimeout(
    supabase.storage.from(CREATIVE_BUCKET).createSignedUrls(paths, 3600),
    SIGNED_URL_TIMEOUT_MS,
    "Tempo limite ao carregar imagens da galeria.",
  ).catch(() => null);
  if (!signedResult || signedResult.error) return creatives;

  const signedByPath = new Map(
    (signedResult.data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  );
  return creatives.map((creative) => ({
    ...creative,
    signed_url: creative.storage_path ? signedByPath.get(creative.storage_path) ?? null : null,
  }));
}

export async function uploadCreativeAsset(input: {
  organizationId: string;
  userId?: string | null;
  file: File;
  name: string;
  headline?: string;
  primaryText?: string;
  cta?: string;
  destinationUrl?: string;
  tags?: string[];
}) {
  const id = crypto.randomUUID();
  const path = `${input.organizationId}/${id}/${sanitizeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(CREATIVE_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const isVideo = input.file.type.startsWith("video/");
  const { data, error } = await supabase
    .from("creatives" as any)
    .insert({
      id,
      organization_id: input.organizationId,
      source: "upload",
      name: input.name.trim(),
      type: isVideo ? "video" : "image",
      format: isVideo ? "video" : "image",
      status: "draft",
      publication_status: "draft",
      storage_path: path,
      mime_type: input.file.type || null,
      file_size: input.file.size,
      headline: input.headline?.trim() || null,
      primary_text: input.primaryText?.trim() || null,
      cta: input.cta?.trim() || null,
      destination_url: input.destinationUrl?.trim() || null,
      tags: input.tags ?? [],
      created_by_user_id: input.userId ?? null,
      created_by_ai: false,
      in_use: false,
      performance: {},
      meta_payload: {},
    } as any)
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(CREATIVE_BUCKET).remove([path]);
    throw error;
  }
  return data as unknown as OwnedCreative;
}

export async function updateCreative(id: string, patch: Partial<OwnedCreative>) {
  const allowed = {
    name: patch.name,
    headline: patch.headline,
    primary_text: patch.primary_text,
    cta: patch.cta,
    destination_url: patch.destination_url,
    description: patch.description,
    tags: patch.tags,
    publication_status: patch.publication_status,
  };
  const { data, error } = await supabase
    .from("creatives" as any)
    .update(allowed as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as OwnedCreative;
}

export async function duplicateCreative(creative: OwnedCreative) {
  const { id: _id, created_at: _created, updated_at: _updated, signed_url: _signed, ...copy } = creative;
  const { data, error } = await supabase
    .from("creatives" as any)
    .insert({
      ...copy,
      name: `${creative.name} — cópia`,
      publication_status: "draft",
      status: "draft",
      archived_at: null,
      meta_creative_id: null,
      meta_payload: {},
      in_use: false,
      ads_count: 0,
      active_ads_count: 0,
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as OwnedCreative;
}

export async function archiveCreative(id: string, archived: boolean) {
  const { error } = await supabase
    .from("creatives" as any)
    .update({ archived_at: archived ? new Date().toISOString() : null } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCreative(creative: OwnedCreative) {
  const { error } = await supabase.from("creatives" as any).delete().eq("id", creative.id);
  if (error) throw error;
  if (creative.storage_path) {
    const { count } = await supabase
      .from("creatives" as any)
      .select("id", { count: "exact", head: true })
      .eq("storage_path", creative.storage_path);
    if (!count) await supabase.storage.from(CREATIVE_BUCKET).remove([creative.storage_path]);
  }
}

export async function linkCreativeToCampaign(input: {
  organizationId: string;
  creativeId: string;
  campaignExternalId: string;
  campaignName?: string | null;
  adsetExternalId?: string | null;
  adsetName?: string | null;
  userId?: string | null;
}) {
  const { data, error } = await supabase
    .from("creative_campaign_links" as any)
    .upsert({
      organization_id: input.organizationId,
      creative_id: input.creativeId,
      campaign_external_id: input.campaignExternalId,
      campaign_name: input.campaignName ?? null,
      adset_external_id: input.adsetExternalId ?? null,
      adset_name: input.adsetName ?? null,
      created_by: input.userId ?? null,
      publication_status: "linked",
    } as any, { onConflict: "creative_id,campaign_external_id,adset_external_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
