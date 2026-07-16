import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles, MoreHorizontal, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignService } from "@/services";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Campaign } from "@/types/proads";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCampaigns } from "@/hooks/useMetaData";

type Row = {
  id: string; name: string; platform: string; objective: string; status: any;
  dailyBudget: number; spend: number; leads: number; cpl: number | null; roas: number | null;
  updatedAt: string; createdByAI?: boolean;
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { demoMode } = useDemoMode();
  const meta = useMetaIntegration();
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mockItems, setMockItems] = useState<Campaign[]>([]);

  const useReal = meta.connected && !!meta.selectedAdAccount;
  const camps = useMetaCampaigns({ status: status === "all" ? undefined : status });

  useEffect(() => {
    if (!useReal) campaignService.list().then(setMockItems);
  }, [useReal]);

  const items: Row[] = useMemo(() => {
    if (useReal) {
      return (camps.data?.campaigns ?? []).map((c) => ({
        id: c.id, name: c.name, platform: c.platform, objective: c.objective, status: c.status,
        dailyBudget: c.dailyBudget, spend: c.spend, leads: c.leads, cpl: c.cpl, roas: c.roas,
        updatedAt: c.updatedAt,
      }));
    }
    if (!demoMode) return [];
    return mockItems.map((c) => ({
      id: c.id, name: c.name, platform: c.platform, objective: c.objective, status: c.status,
      dailyBudget: c.dailyBudget, spend: c.spend, leads: c.leads, cpl: c.cpl, roas: c.roas,
      updatedAt: c.updatedAt, createdByAI: c.createdByAI,
    }));
  }, [useReal, camps.data, demoMode, mockItems]);

  const filtered = useMemo(
    () => items.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (platform !== "all" && c.platform !== platform) return false;
      if (status !== "all" && c.status !== status) return false;
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
        description={useReal ? `Meta · ${meta.selectedAdAccount?.name}` : "Todas as suas campanhas em um único lugar."}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => qc.invalidateQueries({ queryKey: ["meta", "campaigns"] })} disabled={!useReal || camps.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${camps.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
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
        {!useReal && !demoMode && (
          <Card className="border-warning/40 bg-warning-soft/40 p-4 shadow-card">
            <p className="text-sm font-semibold">Conta Meta não conectada</p>
            <p className="text-xs text-muted-foreground">Conecte a Meta em Integrações para ver campanhas reais.</p>
            <Button size="sm" className="mt-2" onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
          </Card>
        )}

        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campanhas..." className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
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
              <SelectItem value="ARCHIVED">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selecionadas</span>
              <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Ação em breve")}>Pausar</Button>
            </div>
          )}
        </Card>

        <Card className="shadow-card">
          <div className="overflow-x-auto">
            {useReal && camps.isLoading ? (
              <div className="p-10 text-center text-xs text-muted-foreground">Carregando campanhas da Meta…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {useReal ? "Nenhuma campanha encontrada nesta conta." : "Sem campanhas para exibir."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((c) => c.id)) : new Set())}
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
                      <TableCell><PlatformBadge platform={c.platform as any} /></TableCell>
                      <TableCell className="text-sm capitalize">{c.objective || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(c.dailyBudget)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(c.spend)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatNumber(c.leads)}</TableCell>
                      <TableCell className="text-right text-sm">{c.cpl == null ? "—" : formatCurrency(c.cpl)}</TableCell>
                      <TableCell className="text-right text-sm">{c.roas == null ? "—" : `${c.roas.toFixed(2)}x`}</TableCell>
                      <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.updatedAt ? formatDateTime(c.updatedAt) : "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/campanhas/${c.id}`)}>Visualizar</DropdownMenuItem>
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
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
