import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Copy,
  Dice5,
  ExternalLink,
  ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMetaCreatives,
  useSocialPosts,
  generatePostContent,
} from "@/hooks/useMetaData";
import {
  createPost,
  deletePost,
  markPublished,
  composePostText,
  buildCreativeBrief,
  NETWORK_URLS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type SocialPost,
  type SocialPlatform,
  type PostStatus,
} from "@/lib/social-posts";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "bg-secondary text-foreground",
  scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  ready: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
};

function isReadyToPublish(post: SocialPost) {
  if (post.status !== "scheduled" && post.status !== "ready") return false;
  if (!post.scheduled_for) return post.status === "ready";
  return new Date(post.scheduled_for).getTime() <= Date.now();
}

export default function ContentPlannerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useMetaIntegration();
  const { user } = useAuth();
  const postsQuery = useSocialPosts();
  const creativesQuery = useMetaCreatives();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [randomizeOpen, setRandomizeOpen] = useState(false);

  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data]);
  const creatives = useMemo(() => creativesQuery.data?.creatives ?? [], [creativesQuery.data]);

  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (platformFilter !== "all" && !p.platforms.includes(platformFilter as SocialPlatform)) return false;
        return true;
      }),
    [posts, statusFilter, platformFilter],
  );

  const readyNow = useMemo(() => posts.filter(isReadyToPublish), [posts]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["social-posts", organizationId] });

  const publish = async (post: SocialPost) => {
    try {
      await navigator.clipboard.writeText(composePostText(post));
      toast.success("Legenda copiada — cole na rede social");
    } catch {
      toast.message("Copie a legenda manualmente");
    }
    const platform = post.platforms[0] ?? "instagram_feed";
    window.open(NETWORK_URLS[platform], "_blank", "noopener,noreferrer");
    try {
      await markPublished(post.id, user?.id);
      await refresh();
    } catch {
      /* non-blocking */
    }
  };

  const remove = async (post: SocialPost) => {
    if (!window.confirm("Excluir este post?")) return;
    await deletePost(post.id);
    await refresh();
    toast.success("Post excluído");
  };

  return (
    <>
      <PageHeader
        title="Conteúdo"
        description="Planeje, agende e publique posts e stories no Instagram e Facebook."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRandomizeOpen(true)}
              title="Gerar uma semana de posts automaticamente"
            >
              <Dice5 className="h-3.5 w-3.5 text-accent" /> Randomizar semana
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-gradient-brand text-primary-foreground"
              onClick={() => navigate("/conteudo/novo")}
            >
              <Plus className="h-3.5 w-3.5" /> Novo post
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{posts.length} posts</Badge>
          <Badge variant="outline">{posts.filter((p) => p.status === "scheduled").length} agendados</Badge>
          <Badge variant="outline">{posts.filter((p) => p.status === "published").length} publicados</Badge>
          <Badge variant="outline">{readyNow.length} prontos agora</Badge>
        </div>

        {/* Ready-to-publish highlight */}
        {readyNow.length > 0 && (
          <Card className="border-amber-400/40 bg-amber-500/5 p-4 shadow-card">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-amber-600" />
              <h2 className="font-display font-bold">Prontos para publicar agora</h2>
            </div>
            <div className="mt-3 space-y-2">
              {readyNow.map((post) => (
                <div key={post.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                  <Thumb post={post} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{post.title || post.caption || "Post sem título"}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.platforms.map((p) => PLATFORM_LABELS[p]).join(" · ") || "Sem plataforma"}
                      {post.scheduled_for ? ` · ${formatDate(post.scheduled_for)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground" onClick={() => publish(post)}>
                    <ExternalLink className="h-3.5 w-3.5" /> Publicar
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-primary" /> Fila de conteúdo
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              <SelectItem value="instagram_feed">Instagram Feed</SelectItem>
              <SelectItem value="instagram_story">Instagram Story</SelectItem>
              <SelectItem value="facebook_feed">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => void postsQuery.refetch()}>
            <RefreshCw className={cn("h-3.5 w-3.5", postsQuery.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </Card>

        {postsQuery.isPending && postsQuery.fetchStatus === "fetching" ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Carregando conteúdo…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum post ainda"
            description="Crie um post pronto para publicar ou gere uma semana inteira com um clique."
            action={{ label: "Criar primeiro post", onClick: () => navigate("/conteudo/novo") }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <Card
                key={post.id}
                className="group cursor-pointer overflow-hidden shadow-card hover:shadow-card-md"
                onClick={() => navigate(`/conteudo/${post.id}`)}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <Thumb post={post} className="h-full w-full" />
                  <Badge className={cn("absolute right-2 top-2 border-0", STATUS_STYLES[post.status])}>
                    {STATUS_LABELS[post.status]}
                  </Badge>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{post.title || "Post sem título"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {post.caption || "Sem legenda"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{post.platforms.map((p) => PLATFORM_LABELS[p]).join(" · ") || "Sem plataforma"}</span>
                    {post.scheduled_for && <span>· {formatDate(post.scheduled_for)}</span>}
                  </div>
                  <div className="mt-3 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(composePostText(post));
                          toast.success("Legenda copiada");
                        } catch {
                          toast.error("Não foi possível copiar");
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => publish(post)}
                    >
                      <ExternalLink className="h-3 w-3" /> Publicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => remove(post)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RandomizeWeekDialog
        open={randomizeOpen}
        onOpenChange={setRandomizeOpen}
        creativesCount={creatives.length}
        onGenerate={async ({ weekdays, time, platform, weeks }) => {
          if (!organizationId) return;
          if (!creatives.length) {
            toast.error("Adicione criativos à galeria primeiro");
            return;
          }
          const dates = upcomingDates(weekdays, time, weeks);
          if (!dates.length) {
            toast.error("Selecione ao menos um dia da semana");
            return;
          }
          let created = 0;
          for (const date of dates) {
            const creative = creatives[Math.floor(Math.random() * creatives.length)];
            let content = {
              title: creative.headline || creative.name,
              caption: creative.primary_text || "",
              hashtags: [] as string[],
              cta: creative.cta || "",
              mentions: [] as string[],
            };
            try {
              content = await generatePostContent({
                brief: buildCreativeBrief(creative),
                platform,
                organizationId,
              });
            } catch {
              /* fall back to creative fields */
            }
            try {
              await createPost({
                organizationId,
                userId: user?.id,
                creativeId: creative.id,
                platforms: [platform],
                title: content.title,
                caption: content.caption,
                hashtags: content.hashtags,
                cta: content.cta,
                mentions: content.mentions,
                mediaUrl: creative.media_url ?? creative.thumbnail_url ?? null,
                storagePath: creative.storage_path ?? null,
                mediaType: creative.type ?? null,
                scheduledFor: date,
                status: "scheduled",
                source: "randomized",
              });
              created += 1;
            } catch {
              /* skip failures */
            }
          }
          await refresh();
          setRandomizeOpen(false);
          toast.success(`${created} post(s) agendados`);
        }}
      />
    </>
  );
}

function Thumb({ post, className }: { post: SocialPost; className?: string }) {
  const url = post.signed_url || post.media_url;
  if (url && post.media_type === "video") {
    return <video src={url} muted preload="metadata" className={cn("shrink-0 rounded-md bg-muted object-cover", className ?? "h-12 w-12")} />;
  }
  if (url) {
    return <img src={url} alt="" loading="lazy" className={cn("shrink-0 rounded-md bg-muted object-cover", className ?? "h-12 w-12")} />;
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted", className ?? "h-12 w-12")}>
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

/** Compute scheduled ISO datetimes for the selected weekdays over N weeks. */
function upcomingDates(weekdays: number[], time: string, weeks: number): string[] {
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const out: string[] = [];
  const now = new Date();
  for (let week = 0; week < weeks; week++) {
    for (const wd of weekdays) {
      const d = new Date(now);
      const diff = (wd - now.getDay() + 7) % 7;
      d.setDate(now.getDate() + diff + week * 7);
      d.setHours(hh || 9, mm || 0, 0, 0);
      if (d.getTime() > now.getTime()) out.push(d.toISOString());
    }
  }
  return out.sort();
}

function RandomizeWeekDialog({
  open,
  onOpenChange,
  creativesCount,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creativesCount: number;
  onGenerate: (input: { weekdays: number[]; time: string; platform: SocialPlatform; weeks: number }) => Promise<void>;
}) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("09:00");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram_feed");
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);

  const toggle = (wd: number) =>
    setWeekdays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Randomizar semana</DialogTitle>
          <DialogDescription>
            Escolha os dias e o horário. Vamos montar posts prontos, cada um com um criativo e conteúdo variados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Dias da semana</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle(index)}
                  className={cn(
                    "h-9 w-11 rounded-md border text-xs font-medium transition-colors",
                    weekdays.includes(index)
                      ? "border-primary/40 bg-gradient-brand-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/20",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Semanas</Label>
              <Select value={String(weeks)} onValueChange={(v) => setWeeks(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} semana{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Plataforma</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram_feed">Instagram Feed</SelectItem>
                <SelectItem value="instagram_story">Instagram Story</SelectItem>
                <SelectItem value="facebook_feed">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {creativesCount === 0 && (
            <p className="text-xs text-destructive">Você ainda não tem criativos na galeria.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button
            className="gap-2 bg-gradient-brand text-primary-foreground"
            disabled={busy || creativesCount === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await onGenerate({ weekdays, time, platform, weeks });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Dice5 className={cn("h-4 w-4", busy && "animate-spin")} />
            {busy ? "Gerando…" : "Gerar posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
