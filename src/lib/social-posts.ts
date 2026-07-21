import { supabase } from "@/integrations/supabase/client";
import { CREATIVE_BUCKET } from "@/lib/creative-library";

const POSTS_QUERY_TIMEOUT_MS = 12_000;
const SIGNED_URL_TIMEOUT_MS = 8_000;

export type SocialPlatform = "instagram_feed" | "instagram_story" | "facebook_feed";
export type PostStatus = "draft" | "scheduled" | "ready" | "published" | "failed" | "skipped";
export type PostSource = "manual" | "ai" | "randomized";

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram_feed: "Instagram Feed",
  instagram_story: "Instagram Story",
  facebook_feed: "Facebook",
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  ready: "Pronto para publicar",
  published: "Publicado",
  failed: "Falhou",
  skipped: "Pulado",
};

export type SocialPost = {
  id: string;
  organization_id: string;
  creative_id: string | null;
  platforms: SocialPlatform[];
  title: string | null;
  caption: string | null;
  hashtags: string[];
  cta: string | null;
  link_url: string | null;
  mentions: string[];
  media_url: string | null;
  storage_path: string | null;
  media_type: string | null;
  scheduled_for: string | null;
  status: PostStatus;
  source: PostSource;
  page_external_id: string | null;
  external_post_id: string | null;
  publish_error: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
};

export type CreatePostInput = {
  organizationId: string;
  creativeId?: string | null;
  platforms?: SocialPlatform[];
  title?: string | null;
  caption?: string | null;
  hashtags?: string[];
  cta?: string | null;
  linkUrl?: string | null;
  mentions?: string[];
  mediaUrl?: string | null;
  storagePath?: string | null;
  mediaType?: string | null;
  scheduledFor?: string | null;
  status?: PostStatus;
  source?: PostSource;
  pageExternalId?: string | null;
  userId?: string | null;
};

export const NETWORK_URLS: Record<SocialPlatform, string> = {
  instagram_feed: "https://www.instagram.com/",
  instagram_story: "https://www.instagram.com/",
  facebook_feed: "https://www.facebook.com/",
};

/** Full caption block ready to paste into Instagram/Facebook. */
export function composePostText(post: {
  title?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  cta?: string | null;
  mentions?: string[] | null;
  link_url?: string | null;
}): string {
  const parts: string[] = [];
  const body = post.caption?.trim() || post.title?.trim();
  if (body) parts.push(body);
  if (post.cta?.trim()) parts.push(post.cta.trim());
  if (post.mentions?.length) parts.push(post.mentions.join(" "));
  if (post.link_url?.trim()) parts.push(post.link_url.trim());
  if (post.hashtags?.length) parts.push(post.hashtags.join(" "));
  return parts.join("\n\n");
}

/** ISO -> value for <input type="datetime-local"> in local time. */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** datetime-local value -> ISO string (UTC). */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Build an AI brief from a creative + optional theme, for post content generation. */
export function buildCreativeBrief(
  creative: {
    name?: string | null;
    headline?: string | null;
    primary_text?: string | null;
    description?: string | null;
    tags?: string[] | null;
  } | null | undefined,
  theme?: string,
): string {
  const lines: string[] = [
    "Marca: Obras Timelapse — registro em timelapse e acompanhamento de obras/construção civil.",
  ];
  if (theme?.trim()) lines.push(`Tema do post: ${theme.trim()}`);
  if (creative?.name) lines.push(`Criativo: ${creative.name}`);
  if (creative?.headline) lines.push(`Título de referência: ${creative.headline}`);
  if (creative?.primary_text) lines.push(`Copy de referência: ${creative.primary_text}`);
  if (creative?.description) lines.push(`Observações: ${creative.description}`);
  if (creative?.tags?.length) lines.push(`Tags: ${creative.tags.join(", ")}`);
  if (lines.length === 1) lines.push("Gere um post institucional/engajador para a marca.");
  return lines.join("\n");
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

function normalize(row: any): SocialPost {
  return {
    ...row,
    platforms: row.platforms ?? [],
    hashtags: row.hashtags ?? [],
    mentions: row.mentions ?? [],
    signed_url: null,
  } as SocialPost;
}

export async function listPosts(organizationId: string, signal?: AbortSignal) {
  let query = supabase
    .from("social_posts" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await withTimeout(
    query,
    POSTS_QUERY_TIMEOUT_MS,
    "O planejador demorou demais para responder. Tente novamente.",
  );
  if (error) throw error;

  const posts = ((data ?? []) as any[]).map(normalize);
  const paths = [...new Set(posts.map((p) => p.storage_path).filter(Boolean))] as string[];
  if (!paths.length) return posts;

  const signedResult = await withTimeout(
    supabase.storage.from(CREATIVE_BUCKET).createSignedUrls(paths, 3600),
    SIGNED_URL_TIMEOUT_MS,
    "Tempo limite ao carregar as mídias dos posts.",
  ).catch(() => null);
  if (!signedResult || signedResult.error) return posts;

  const signedByPath = new Map<string, string>();
  for (const item of signedResult.data ?? []) {
    if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
  }
  return posts.map<SocialPost>((post) => ({
    ...post,
    signed_url: post.storage_path ? signedByPath.get(post.storage_path) ?? null : null,
  }));
}

export async function createPost(input: CreatePostInput) {
  const { data, error } = await supabase
    .from("social_posts" as any)
    .insert({
      organization_id: input.organizationId,
      creative_id: input.creativeId ?? null,
      platforms: input.platforms ?? ["instagram_feed"],
      title: input.title?.trim() || null,
      caption: input.caption?.trim() || null,
      hashtags: input.hashtags ?? [],
      cta: input.cta?.trim() || null,
      link_url: input.linkUrl?.trim() || null,
      mentions: input.mentions ?? [],
      media_url: input.mediaUrl ?? null,
      storage_path: input.storagePath ?? null,
      media_type: input.mediaType ?? null,
      scheduled_for: input.scheduledFor ?? null,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      page_external_id: input.pageExternalId ?? null,
      created_by: input.userId ?? null,
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updatePost(id: string, patch: Partial<SocialPost>) {
  const allowed = {
    creative_id: patch.creative_id,
    platforms: patch.platforms,
    title: patch.title,
    caption: patch.caption,
    hashtags: patch.hashtags,
    cta: patch.cta,
    link_url: patch.link_url,
    mentions: patch.mentions,
    media_url: patch.media_url,
    storage_path: patch.storage_path,
    media_type: patch.media_type,
    scheduled_for: patch.scheduled_for,
    status: patch.status,
    page_external_id: patch.page_external_id,
  };
  const clean = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  const { data, error } = await supabase
    .from("social_posts" as any)
    .update(clean as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("social_posts" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function duplicatePost(post: SocialPost) {
  const { data, error } = await supabase
    .from("social_posts" as any)
    .insert({
      organization_id: post.organization_id,
      creative_id: post.creative_id,
      platforms: post.platforms,
      title: post.title,
      caption: post.caption,
      hashtags: post.hashtags,
      cta: post.cta,
      link_url: post.link_url,
      mentions: post.mentions,
      media_url: post.media_url,
      storage_path: post.storage_path,
      media_type: post.media_type,
      scheduled_for: null,
      status: "draft",
      source: post.source,
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function markPublished(id: string, userId?: string | null) {
  const { data, error } = await supabase
    .from("social_posts" as any)
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: userId ?? null,
      publish_error: null,
    } as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}
