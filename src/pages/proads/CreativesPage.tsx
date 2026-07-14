import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid2x2, List, Plus, Search, Sparkles, Upload, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { creativeService } from "@/services";
import type { Creative, CreativeStatus, CreativeType } from "@/types/proads";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyle: Record<CreativeStatus, string> = {
  approved: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  rejected: "bg-destructive/10 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

export default function CreativesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Creative[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => { creativeService.list().then(setItems); }, []);

  const filtered = useMemo(
    () =>
      items.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (type !== "all" && c.type !== (type as CreativeType)) return false;
        if (status !== "all" && c.status !== (status as CreativeStatus)) return false;
        return true;
      }),
    [items, q, type, status],
  );

  return (
    <>
      <PageHeader
        title="Criativos"
        description="Biblioteca de mídia — imagens, vídeos, carrosséis e stories."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2"><Upload className="h-3.5 w-3.5" /> Upload</Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => navigate("/criativos/novo?ai=1")}>
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Gerar com IA
            </Button>
            <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => navigate("/criativos/novo")}>
              <Plus className="h-3.5 w-3.5" /> Novo criativo
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
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
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Formato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos formatos</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="carousel">Carrossel</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="reel">Reels</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
            <ToggleGroupItem value="grid" size="sm"><Grid2x2 className="h-3.5 w-3.5" /></ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
          </ToggleGroup>
        </Card>

        {view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((c) => (
              <Card key={c.id} className="group cursor-pointer overflow-hidden shadow-card transition-shadow hover:shadow-card-md" onClick={() => navigate(`/criativos/${c.id}`)}>
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <Badge className={cn("absolute right-2 top-2 border-0", statusStyle[c.status])}>
                    {c.status === "approved" ? "Aprovado" : c.status === "pending" ? "Pendente" : c.status === "rejected" ? "Rejeitado" : "Rascunho"}
                  </Badge>
                  {c.createdByAI && (
                    <Badge className="absolute left-2 top-2 gap-1 bg-gradient-brand text-white">
                      <Sparkles className="h-2.5 w-2.5" /> IA
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.format} · {c.resolution}</span>
                    <PlatformBadge platform={c.platform} showLabel={false} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border shadow-card">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-3 hover:bg-secondary/40" onClick={() => navigate(`/criativos/${c.id}`)}>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.format} · {c.resolution} · {formatDate(c.createdAt)}</p>
                </div>
                <PlatformBadge platform={c.platform} />
                <Badge className={cn("border-0", statusStyle[c.status])}>{c.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Visualizar</DropdownMenuItem>
                    <DropdownMenuItem>Duplicar</DropdownMenuItem>
                    <DropdownMenuItem>Gerar variação</DropdownMenuItem>
                    <DropdownMenuItem>Aprovar</DropdownMenuItem>
                    <DropdownMenuItem>Rejeitar</DropdownMenuItem>
                    <DropdownMenuItem>Baixar</DropdownMenuItem>
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
