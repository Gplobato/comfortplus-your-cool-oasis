import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Sparkles, MoreHorizontal, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { campaignService } from "@/services";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Campaign, CampaignStatus, Platform } from "@/types/proads";
import { toast } from "sonner";

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Campaign[]>([]);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    campaignService.list().then(setItems);
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (platform !== "all" && c.platform !== (platform as Platform)) return false;
        if (status !== "all" && c.status !== (status as CampaignStatus)) return false;
        return true;
      }),
    [items, q, platform, status],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Todas as suas campanhas em um único lugar — filtre, otimize e crie com IA."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => navigate("/campanhas/nova?ai=1")}>
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Criar com IA
            </Button>
            <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => navigate("/campanhas/nova")}>
              <Plus className="h-3.5 w-3.5" /> Nova campanha
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
        {/* Filters */}
        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar campanhas..."
              className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativas</SelectItem>
              <SelectItem value="PAUSED">Pausadas</SelectItem>
              <SelectItem value="DRAFT">Rascunho</SelectItem>
              <SelectItem value="ARCHIVED">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Objetivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos objetivos</SelectItem>
              <SelectItem value="leads">Leads</SelectItem>
              <SelectItem value="conversions">Conversões</SelectItem>
              <SelectItem value="traffic">Tráfego</SelectItem>
              <SelectItem value="awareness">Reconhecimento</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Criada por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="human">Humanos</SelectItem>
              <SelectItem value="ai">Agente IA</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selecionadas</span>
              <Button variant="outline" size="sm" className="h-8" onClick={() => toast.success("Pausadas")}>Pausar</Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => toast.success("Arquivadas")}>Arquivar</Button>
            </div>
          )}
        </Card>

        {/* Table */}
        <Card className="shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={(v) =>
                        setSelected(v ? new Set(filtered.map((c) => c.id)) : new Set())
                      }
                    />
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Campanha</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Plataforma</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Objetivo</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Orç. diário</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Investimento</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Leads</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">CPL</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">ROAS</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Atualizado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer border-border" onClick={() => navigate(`/campanhas/${c.id}`)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c.name}</span>
                        {c.createdByAI && (
                          <Badge variant="outline" className="gap-1 bg-violet-soft text-violet-soft-foreground">
                            <Sparkles className="h-2.5 w-2.5" /> IA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><PlatformBadge platform={c.platform} /></TableCell>
                    <TableCell className="text-sm capitalize">{c.objective}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.dailyBudget)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.spend)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatNumber(c.leads)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.cpl)}</TableCell>
                    <TableCell className="text-right text-sm">{c.roas.toFixed(2)}x</TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.updatedAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/campanhas/${c.id}`)}>Visualizar</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Duplicar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Pausar</DropdownMenuItem>
                          <DropdownMenuItem>Ativar</DropdownMenuItem>
                          <DropdownMenuItem>Arquivar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2">
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir no gerenciador
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
