import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Dice5,
  ExternalLink,
  ImageIcon,
  Instagram,
  Facebook,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMetaCreatives, useSocialPosts, generatePostContent } from "@/hooks/useMetaData";
import type { LibraryCreative } from "@/hooks/useMetaData";
import {
  createPost,
  updatePost,
  deletePost,
  markPublished,
  composePostText,
  buildCreativeBrief,
  toDatetimeLocal,
  fromDatetimeLocal,
  NETWORK_URLS,
  type SocialPlatform,
  type PostStatus,
} from "@/lib/social-posts";

const PLATFORMS: { id: SocialPlatform; label: string; icon: typeof Instagram }[] = [
  { id: "instagram_feed", label: "Instagram Feed", icon: Instagram },
  { id: "instagram_story", label: "Instagram Story", icon: Instagram },
  { id: "facebook_feed", label: "Facebook", icon: Facebook },
];

type EditorForm = {
  creativeId: string;
  platforms: SocialPlatform[];
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  mentions: string[];
  linkUrl: string;
  scheduledFor: string;
  status: PostStatus;
};

const emptyForm: EditorForm = {
  creativeId: "",
  platforms: ["instagram_feed"],
  title: "",
  caption: "",
  hashtags: [],
  cta: "",
  mentions: [],
  linkUrl: "",
  scheduledFor: "",
  status: "draft",
};

export default function PostEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { organizationId } = useMetaIntegration();
  const { user } = useAuth();

  const creativesQuery = useMetaCreatives();
  const creatives = useMemo(() => creativesQuery.data?.creatives ?? [], [creativesQuery.data]);
  const postsQuery = useSocialPosts();
  const existing = useMemo(
    () => (isNew ? undefined : postsQuery.data?.posts.find((p) => p.id === id)),
    [id, isNew, postsQuery.data],
  );

  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const selectedCreative = creatives.find((c) => c.id === form.creativeId) ?? null;

  // Preselect creative for a brand-new post (?creative=<id>)
  useEffect(() => {
    if (!isNew) return;
    const preset = searchParams.get("creative");
    if (preset && !form.creativeId) setForm((f) => ({ ...f, creativeId: preset }));
  }, [isNew, searchParams, form.creativeId]);

  // Load existing post into the form once
  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setForm({
      creativeId: existing.creative_id ?? "",
      platforms: existing.platforms.length ? existing.platforms : ["instagram_feed"],
      title: existing.title ?? "",
      caption: existing.caption ?? "",
      hashtags: existing.hashtags ?? [],
      cta: existing.cta ?? "",
      mentions: existing.mentions ?? [],
      linkUrl: existing.link_url ?? "",
      scheduledFor: toDatetimeLocal(existing.scheduled_for),
      status: existing.status,
    });
    setLoadedId(existing.id);
  }, [existing, loadedId]);

  const togglePlatform = (platform: SocialPlatform) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(platform)
        ? f.platforms.filter((p) => p !== platform)
        : [...f.platforms, platform],
    }));
  };

  const runGenerate = async (creativeId?: string) => {
    if (!organizationId) return;
    const creative = creatives.find((c) => c.id === (creativeId ?? form.creativeId)) ?? null;
    setGenerating(true);
    try {
      const platform = form.platforms[0] ?? "instagram_feed";
      const content = await generatePostContent({
        brief: buildCreativeBrief(creative, theme),
        platform,
        organizationId,
      });
      setForm((f) => ({
        ...f,
        title: content.title || f.title,
        caption: content.caption || f.caption,
        hashtags: content.hashtags.length ? content.hashtags : f.hashtags,
        cta: content.cta || f.cta,
        mentions: content.mentions.length ? content.mentions : f.mentions,
      }));
      toast.success("Conteúdo pronto gerado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar conteúdo");
    } finally {
      setGenerating(false);
    }
  };

  const randomize = async () => {
    if (!creatives.length) return toast.error("Adicione criativos à galeria primeiro");
    const random = creatives[Math.floor(Math.random() * creatives.length)];
    setForm((f) => ({ ...f, creativeId: random.id }));
    await runGenerate(random.id);
  };

  const buildPayload = (status: PostStatus) => {
    const creative = creatives.find((c) => c.id === form.creativeId) ?? null;
    return {
      creativeId: form.creativeId || null,
      platforms: form.platforms,
      title: form.title,
      caption: form.caption,
      hashtags: form.hashtags,
      cta: form.cta,
      linkUrl: form.linkUrl,
      mentions: form.mentions,
      mediaUrl: creative?.media_url ?? creative?.thumbnail_url ?? null,
      storagePath: creative?.storage_path ?? null,
      mediaType: creative?.type ?? null,
      scheduledFor: fromDatetimeLocal(form.scheduledFor),
      status,
    };
  };

  const persist = async (status: PostStatus) => {
    if (!organizationId) return;
    if (!form.platforms.length) return toast.error("Selecione ao menos uma plataforma");
    setSaving(true);
    try {
      const payload = buildPayload(status);
      if (isNew) {
        const created = await createPost({ organizationId, userId: user?.id, ...payload });
        await queryClient.invalidateQueries({ queryKey: ["social-posts", organizationId] });
        toast.success("Post salvo");
        navigate(`/conteudo/${created.id}`, { replace: true });
      } else if (existing) {
        await updatePost(existing.id, {
          creative_id: payload.creativeId,
          platforms: payload.platforms,
          title: payload.title || null,
          caption: payload.caption || null,
          hashtags: payload.hashtags,
          cta: payload.cta || null,
          link_url: payload.linkUrl || null,
          mentions: payload.mentions,
          media_url: payload.mediaUrl,
          storage_path: payload.storagePath,
          media_type: payload.mediaType,
          scheduled_for: payload.scheduledFor,
          status,
        });
        await queryClient.invalidateQueries({ queryKey: ["social-posts", organizationId] });
        toast.success("Post atualizado");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const publishNow = async () => {
    const text = composePostText({
      title: form.title,
      caption: form.caption,
      hashtags: form.hashtags,
      cta: form.cta,
      mentions: form.mentions,
      link_url: form.linkUrl,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Legenda copiada — cole na rede social");
    } catch {
      toast.message("Copie a legenda abaixo manualmente");
    }
    const platform = form.platforms[0] ?? "instagram_feed";
    window.open(NETWORK_URLS[platform], "_blank", "noopener,noreferrer");
    if (!isNew && existing) {
      try {
        await markPublished(existing.id, user?.id);
        await queryClient.invalidateQueries({ queryKey: ["social-posts", organizationId] });
        setForm((f) => ({ ...f, status: "published" }));
      } catch {
        /* non-blocking */
      }
    }
  };

  if (!isNew && postsQuery.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando post…</div>;
  }
  if (!isNew && !existing && !postsQuery.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/conteudo")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <EmptyState icon={ImageIcon} title="Post não encontrado" description="Ele pode ter sido excluído." />
      </div>
    );
  }

  const mediaUrl = selectedCreative?.signed_url || selectedCreative?.media_url || selectedCreative?.thumbnail_url;

  return (
    <>
      <PageHeader
        title={isNew ? "Novo post" : existing?.title || "Editar post"}
        description="Conteúdo pronto para publicar: título, legenda, hashtags e agendamento."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate("/conteudo")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={randomize}
              disabled={generating}
              title="Randomizar: escolhe um criativo e gera o conteúdo automaticamente"
            >
              <Dice5 className={cn("h-4 w-4 text-accent", generating && "animate-spin")} /> Randomizar
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-gradient-brand text-primary-foreground"
              disabled={saving}
              onClick={() => persist(form.scheduledFor ? "scheduled" : "draft")}
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 lg:grid-cols-3 md:p-8">
        {/* Preview + media */}
        <div className="space-y-4">
          <Card className="overflow-hidden shadow-card">
            {mediaUrl ? (
              selectedCreative?.type === "video" ? (
                <video src={mediaUrl} controls className="max-h-[420px] w-full bg-black object-contain" />
              ) : (
                <img src={mediaUrl} alt="" className="max-h-[420px] w-full bg-muted object-contain" />
              )
            ) : (
              <div className="flex aspect-square items-center justify-center bg-muted">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </Card>

          <Card className="p-4 shadow-card">
            <Label className="mb-1.5 block">Mídia (criativo da galeria)</Label>
            <Select value={form.creativeId} onValueChange={(v) => setForm({ ...form, creativeId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione um criativo" /></SelectTrigger>
              <SelectContent>
                {creatives.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-2"
              onClick={() => navigate("/criativos")}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Abrir galeria
            </Button>
          </Card>
        </div>

        {/* Content form */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-bold">Conteúdo do post</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => runGenerate()}
                disabled={generating}
              >
                <Sparkles className={cn("h-3.5 w-3.5 text-accent", generating && "animate-pulse")} />
                {generating ? "Gerando…" : form.caption ? "Regenerar" : "Gerar com IA"}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <Field label="Plataformas">
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const active = form.platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-gradient-brand-soft text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/20",
                        )}
                      >
                        <p.icon className="h-3.5 w-3.5" /> {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Tema/assunto (opcional, ajuda a IA)">
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex.: acompanhamento mensal de obra, antes e depois..."
                />
              </Field>

              <Field label="Título / gancho">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>

              <Field label="Legenda">
                <Textarea
                  className="min-h-40"
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  placeholder="A legenda pronta aparecerá aqui..."
                />
              </Field>

              <Field label="Hashtags">
                <TagInput
                  values={form.hashtags}
                  prefix="#"
                  placeholder="Digite e Enter para adicionar"
                  onChange={(hashtags) => setForm({ ...form, hashtags })}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="CTA">
                  <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} />
                </Field>
                <Field label="Menções">
                  <TagInput
                    values={form.mentions}
                    prefix="@"
                    placeholder="@perfil e Enter"
                    onChange={(mentions) => setForm({ ...form, mentions })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Link (bio/destino)">
                  <Input
                    type="url"
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="https://"
                  />
                </Field>
                <Field label="Agendar para">
                  <Input
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <h2 className="font-display font-bold">Publicação</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A publicação automática nas redes chega em breve. Por enquanto, ao publicar copiamos a legenda pronta
              e abrimos a rede para você colar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => persist("scheduled")}
                disabled={saving || !form.scheduledFor}
              >
                <Save className="h-4 w-4" /> Salvar e agendar
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-gradient-brand text-primary-foreground"
                onClick={publishNow}
              >
                <ExternalLink className="h-4 w-4" /> Publicar agora
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      composePostText({
                        title: form.title,
                        caption: form.caption,
                        hashtags: form.hashtags,
                        cta: form.cta,
                        mentions: form.mentions,
                        link_url: form.linkUrl,
                      }),
                    );
                    toast.success("Legenda copiada");
                  } catch {
                    toast.error("Não foi possível copiar");
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copiar legenda
              </Button>
              {!isNew && existing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Excluir este post?")) return;
                    await deletePost(existing.id);
                    await queryClient.invalidateQueries({ queryKey: ["social-posts", organizationId] });
                    toast.success("Post excluído");
                    navigate("/conteudo");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              )}
            </div>
            {form.status === "published" && (
              <Badge className="mt-3" variant="secondary">Publicado</Badge>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function TagInput({
  values,
  onChange,
  prefix,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  prefix: "#" | "@";
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const raw = draft.trim().replace(/^[#@\s]+/, "");
    if (!raw) return;
    const value = `${prefix}${raw.replace(/\s+/g, "")}`;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  };

  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2">
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="flex items-center gap-1 rounded-full bg-gradient-brand-soft px-2 py-0.5 text-xs text-primary">
              {value}
              <button type="button" onClick={() => onChange(values.filter((v) => v !== value))} aria-label={`Remover ${value}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="h-8 w-full bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}
