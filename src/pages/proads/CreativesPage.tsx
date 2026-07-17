import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Grid2x2, ImageIcon, List, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMetaCreatives, type LibraryCreative } from "@/hooks/useMetaData";

const publicationLabel: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  published: "Publicado",
  failed: "Falhou",
};

export default function CreativesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useMetaCreatives({ includeArchived });
  const items = query.data?.creatives ?? [];

  const filtered = useMemo(() => items.filter((creative) => {
    const needle = q.trim().toLowerCase();
    if (needle && ![
      creative.name,
      creative.headline,
      creative.primary_text,
      ...(creative.tags ?? []),
    ].some((value) => String(value ?? "").toLowerCase().includes(needle))) return false;
    if (type !== "all" && creative.type !== type) return false;
    if (origin !== "all" && creative.source !== origin) return false;
    return true;
  }), [items, origin, q, type]);

  return (
    <>
      <PageHeader
        title="Galeria de criativos"
        description="Seus arquivos, copies e variações. A galeria não importa anúncios da Meta."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/agente")}>
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Gerar com IA
            </Button>
            <Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground" onClick={() => navigate("/criativos/novo")}>
              <Plus className="h-3.5 w-3.5" /> Adicionar criativo
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{query.data?.counts.total ?? 0} itens</Badge>
          <Badge variant="outline">{query.data?.counts.upload ?? 0} uploads</Badge>
          <Badge variant="outline">{query.data?.counts.ai ?? 0} gerados por IA</Badge>
          <Badge variant="outline">{query.data?.counts.ready ?? 0} prontos para publicar</Badge>
        </div>

        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar por nome, copy ou tag..."
              className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="upload">Uploads</SelectItem>
              <SelectItem value="ai">Gerados por IA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-[135px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos formatos</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={includeArchived ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              setIncludeArchived((value) => !value);
              void queryClient.invalidateQueries({ queryKey: ["creative-library"] });
            }}
          >
            <Archive className="h-3.5 w-3.5" /> Arquivados
          </Button>
          <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as "grid" | "list")}>
            <ToggleGroupItem value="grid" size="sm"><Grid2x2 className="h-3.5 w-3.5" /></ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
          </ToggleGroup>
        </Card>

        {query.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando sua galeria…</div>
        ) : query.error ? (
          <Card className="space-y-2 border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Não foi possível carregar a galeria</p>
            <p className="text-muted-foreground">{query.error.message}</p>
            {String(query.error.message).includes("creatives") && (
              <p className="text-xs text-muted-foreground">
                A tabela da galeria ainda não foi aplicada no Supabase do Lovable. Após o push da migration
                `ensure_creatives_gallery`, recarregue esta página.
              </p>
            )}
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Sua galeria está vazia"
            description="Faça upload de uma imagem ou vídeo, ou gere uma variação com a IA."
            action={{ label: "Adicionar primeiro criativo", onClick: () => navigate("/criativos/novo") }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((creative) => (
              <CreativeCard key={creative.id} creative={creative} onClick={() => navigate(`/criativos/${creative.id}`)} />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden shadow-card">
            {filtered.map((creative) => (
              <button
                key={creative.id}
                type="button"
                className="flex w-full items-center gap-4 p-3 text-left hover:bg-secondary/40"
                onClick={() => navigate(`/criativos/${creative.id}`)}
              >
                <CreativeThumb creative={creative} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{creative.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {creative.type === "video" ? "Vídeo" : "Imagem"} · {creative.source === "ai" ? "IA" : "Upload"} · {formatDate(creative.updated_at)}
                  </p>
                </div>
                <Badge variant="outline">{publicationLabel[creative.publication_status] ?? creative.publication_status}</Badge>
                {creative.archived_at && <Badge variant="secondary">Arquivado</Badge>}
              </button>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

function CreativeThumb({ creative, className }: { creative: LibraryCreative; className?: string }) {
  const url = creative.signed_url || creative.media_url || creative.thumbnail_url;
  if (url && creative.type === "video") {
    return <video src={url} muted className={cn("shrink-0 rounded-md bg-muted object-cover", className)} />;
  }
  if (url) {
    return <img src={url} alt="" className={cn("shrink-0 rounded-md bg-muted object-cover", className)} />;
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted", className)}>
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function CreativeCard({ creative, onClick }: { creative: LibraryCreative; onClick: () => void }) {
  return (
    <Card className="group cursor-pointer overflow-hidden shadow-card hover:shadow-card-md" onClick={onClick}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        <CreativeThumb creative={creative} className="h-full w-full transition-transform group-hover:scale-105" />
        <Badge className="absolute right-2 top-2" variant="secondary">
          {publicationLabel[creative.publication_status] ?? creative.publication_status}
        </Badge>
        {creative.source === "ai" && (
          <Badge className="absolute left-2 top-2 gap-1 bg-gradient-brand text-white">
            <Sparkles className="h-3 w-3" /> IA
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{creative.name}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {creative.headline || creative.description || "Sem copy definida"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(creative.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
        </div>
      </div>
    </Card>
  );
}
