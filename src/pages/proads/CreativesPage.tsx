import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Grid2x2, List, Plus, Search, Sparkles, Upload, MoreHorizontal, RefreshCw, ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { PlatformBadge } from "@/components/proads/Badges";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatCurrency, formatDate, formatMetaCurrency, formatMetaNumber, formatMetaPercent,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCreatives, type LibraryCreative } from "@/hooks/useMetaData";
import { metaKeys } from "@/lib/metaKeys";
import { metaErrorMessage } from "@/lib/metaErrors";
import { toast } from "sonner";

const statusLabel: Record<string, string> = {
  in_use: "Em uso",
  used: "Usado",
  draft: "Rascunho",
  approved: "Aprovado",
  pending: "Pendente",
};

const statusStyle: Record<string, string> = {
  in_use: "bg-success-soft text-success",
  used: "bg-muted text-muted-foreground",
  draft: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
};

export default function CreativesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMetaIntegration();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [inUse, setInUse] = useState<"all" | "true" | "false">("all");
  const [periodKey, setPeriodKey] = useState("30d");
  const [view, setView] = useState<"grid" | "list">("grid");

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const days = periodKey === "7d" ? 7 : periodKey === "14d" ? 14 : periodKey === "90d" ? 90 : 30;
  const { dateFrom, dateTo } = useMemo(() => periodRange(days, tz), [days, tz]);

  const query = useMetaCreatives({
    dateFrom,
    dateTo,
    inUse,
    sync: true,
  });

  const items = query.data?.creatives ?? [];
  const counts = query.data?.counts;

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase()) &&
        !(c.headline ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      if (type !== "all" && c.type !== type) return false;
      if (source !== "all" && c.source !== source) return false;
      return true;
    });
  }, [items, q, type, source]);

  const useReal = meta.connected && !!meta.selectedAdAccount;

  const onRefresh = async () => {
    await qc.invalidateQueries({
      queryKey: metaKeys.creatives(meta.organizationId, meta.selectedAdAccount?.id ?? null),
    });
    toast.success("Biblioteca atualizada");
  };

  return (
    <>
      <PageHeader
        title="Criativos"
        description={
          useReal
            ? `Meta · ${meta.selectedAdAccount?.name} · criativos em uso e já usados + biblioteca IA`
            : "Biblioteca unificada — Meta e criativos gerados por IA."
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onRefresh} disabled={query.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Sincronizar
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" disabled>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => navigate("/agente")}>
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Gerar com IA
            </Button>
            <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => navigate("/criativos/novo")}>
              <Plus className="h-3.5 w-3.5" /> Novo criativo
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
        {!useReal && (
          <Card className="border-warning/40 bg-warning-soft/40 p-4 shadow-card">
            <p className="text-sm font-semibold">Conta Meta não conectada</p>
            <p className="text-xs text-muted-foreground">
              Conecte e selecione uma conta em Integrações para puxar criativos reais. Criativos da IA ainda aparecem se houver.
            </p>
            <Button size="sm" className="mt-2" onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
          </Card>
        )}

        {query.error && (
          <Card className="border-destructive/40 bg-destructive/5 p-3 shadow-card">
            <p className="text-sm font-semibold">{metaErrorMessage(query.error).title}</p>
            <p className="text-xs text-muted-foreground">{metaErrorMessage(query.error).description}</p>
          </Card>
        )}

        {query.data?.warnings && query.data.warnings.length > 0 && (
          <Card className="border-warning/40 bg-warning-soft/30 p-3 text-[11px] shadow-card">
            {String(query.data.warnings[0]).slice(0, 220)}
            {query.data.request_id && (
              <span className="ml-2 text-muted-foreground">request_id: {query.data.request_id}</span>
            )}
          </Card>
        )}

        {counts && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge variant="outline">{counts.total} total</Badge>
            <Badge variant="outline">{counts.meta} Meta</Badge>
            <Badge variant="outline">{counts.in_use} em uso</Badge>
            <Badge variant="outline">{counts.ai} IA</Badge>
          </div>
        )}

        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar criativos..."
              className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Período métricas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Métricas 7d</SelectItem>
              <SelectItem value="14d">Métricas 14d</SelectItem>
              <SelectItem value="30d">Métricas 30d</SelectItem>
              <SelectItem value="90d">Métricas 90d</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="ai">IA</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
            </SelectContent>
          </Select>
          <Select value={inUse} onValueChange={(v) => setInUse(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Uso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Em uso agora</SelectItem>
              <SelectItem value="false">Já usados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Formato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos formatos</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="carousel">Carrossel</SelectItem>
              <SelectItem value="story">Story</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
            <ToggleGroupItem value="grid" size="sm"><Grid2x2 className="h-3.5 w-3.5" /></ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
          </ToggleGroup>
        </Card>

        {query.isLoading && !filtered.length ? (
          <div className="p-10 text-center text-xs text-muted-foreground">Carregando criativos da Meta…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Nenhum criativo encontrado"
            description={
              useReal
                ? "Nenhum criativo vinculado a anúncios nesta conta no filtro atual."
                : "Conecte a Meta ou gere criativos com a IA."
            }
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((c) => (
              <CreativeCard key={c.id} c={c} onClick={() => navigate(`/criativos/${c.id}`)} />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border shadow-card">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex cursor-pointer items-center gap-4 p-3 hover:bg-secondary/40"
                onClick={() => navigate(`/criativos/${c.id}`)}
              >
                <Thumb c={c} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.format || c.type} · {c.source === "meta" ? "Meta" : c.source === "ai" ? "IA" : "Upload"}
                    {c.created_at ? ` · ${formatDate(c.created_at)}` : ""}
                    {c.source === "meta" ? ` · ${c.active_ads_count}/${c.ads_count} anúncios ativos` : ""}
                  </p>
                </div>
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-semibold">{formatCurrency(c.performance?.spend ?? 0)}</p>
                  <p className="text-muted-foreground">
                    CPL {formatMetaCurrency(c.performance?.cpl)} · CTR {formatMetaPercent(c.performance?.ctr)}
                  </p>
                </div>
                <PlatformBadge platform="meta" showLabel={c.source === "meta"} />
                <Badge className={cn("border-0", statusStyle[c.status] ?? statusStyle.used)}>
                  {statusLabel[c.status] ?? c.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/criativos/${c.id}`)}>Visualizar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/agente")}>Gerar variação</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

function Thumb({ c, className }: { c: LibraryCreative; className?: string }) {
  if (c.thumbnail_url) {
    return (
      <div className={cn("shrink-0 overflow-hidden rounded-md bg-muted", className)}>
        <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted", className)}>
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function CreativeCard({ c, onClick }: { c: LibraryCreative; onClick: () => void }) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden shadow-card transition-shadow hover:shadow-card-md"
      onClick={onClick}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {c.thumbnail_url ? (
          <img src={c.thumbnail_url} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <Badge className={cn("absolute right-2 top-2 border-0", statusStyle[c.status] ?? statusStyle.used)}>
          {statusLabel[c.status] ?? c.status}
        </Badge>
        {c.created_by_ai || c.source === "ai" ? (
          <Badge className="absolute left-2 top-2 gap-1 bg-gradient-brand text-white">
            <Sparkles className="h-2.5 w-2.5" /> IA
          </Badge>
        ) : (
          <Badge className="absolute left-2 top-2 border-0 bg-[#1877F2] text-white">Meta</Badge>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{c.format || c.type}</span>
          <span>{formatMetaNumber(c.performance?.leads)} leads</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatCurrency(c.performance?.spend ?? 0)} · CPM {formatMetaCurrency(c.performance?.cpm)}
        </p>
      </div>
    </Card>
  );
}
