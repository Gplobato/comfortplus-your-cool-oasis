import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles, MoreHorizontal, ExternalLink, RefreshCw, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignService } from "@/services";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Campaign } from "@/types/proads";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCampaigns, type MetaCampaignRow } from "@/hooks/useMetaData";
import { metaKeys } from "@/lib/metaKeys";
import { metaErrorMessage } from "@/lib/metaErrors";

type Row = MetaCampaignRow & { createdByAI?: boolean };

const DATE_PRESETS: Record<string, number> = {
  today: 0, "7d": 6, "14d": 13, "30d": 29, "90d": 89,
};

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

const ALL_COLS = [
  { key: "objective", label: "Objetivo" },
  { key: "dailyBudget", label: "Orç. diário" },
  { key: "lifetimeBudget", label: "Orç. total" },
  { key: "budgetRemaining", label: "Restante" },
  { key: "spend", label: "Investimento" },
  { key: "impressions", label: "Impressões" },
  { key: "reach", label: "Alcance" },
  { key: "clicks", label: "Cliques" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "frequency", label: "Freq." },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
  { key: "conversions", label: "Conv." },
  { key: "revenue", label: "Receita" },
  { key: "roas", label: "ROAS" },
] as const;
type ColKey = typeof ALL_COLS[number]["key"];

const DEFAULT_COLS: ColKey[] = [
  "objective", "dailyBudget", "spend", "clicks", "ctr", "cpc", "leads", "cpl", "roas",
];

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { demoMode } = useDemoMode();
  const meta = useMetaIntegration();
  const [status, setStatus] = useState<string>("all");
  const [objective, setObjective] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<string>("14d");
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
  const [mockItems, setMockItems] = useState<Campaign[]>([]);

  const { dateFrom, dateTo } = useMemo(() => {
    const days = DATE_PRESETS[datePreset] ?? 13;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    return { dateFrom: ymd(from), dateTo: ymd(to) };
  }, [datePreset]);

  const useReal = meta.connected && !!meta.selectedAdAccount;
  const camps = useMetaCampaigns({
    status: status === "all" ? undefined : status,
    objective: objective === "all" ? undefined : objective,
    dateFrom, dateTo,
  });

  useEffect(() => { if (!useReal) campaignService.list().then(setMockItems); }, [useReal]);

  const items: Row[] = useMemo(() => {
    if (useReal) return (camps.data?.campaigns ?? []) as Row[];
    if (!demoMode) return [];
    return mockItems.map((c) => ({
      id: c.id, name: c.name, platform: "meta", objective: c.objective,
      status: c.status as any, effective_status: c.status,
      dailyBudget: c.dailyBudget, lifetimeBudget: null, budgetRemaining: null,
      spend: c.spend, impressions: 0, reach: 0, clicks: 0,
      ctr: null, cpc: null, cpm: null, frequency: null,
      leads: c.leads, conversions: 0, revenue: 0,
      cpl: c.cpl, roas: c.roas, startTime: null, stopTime: null,
      createdAt: c.updatedAt, updatedAt: c.updatedAt, createdByAI: c.createdByAI,
    }));
  }, [useReal, camps.data, demoMode, mockItems]);

  const filtered = useMemo(
    () => items.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (platform !== "all" && c.platform !== platform) return false;
      return true;
    }),
    [items, q, platform],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleCol = (k: ColKey) => {
    const next = new Set(cols);
    next.has(k) ? next.delete(k) : next.add(k);
    setCols(next);
  };
  const show = (k: ColKey) => cols.has(k);

  const fmtNum = (n: number | null | undefined) => (n == null ? "—" : formatNumber(n));
  const fmtCur = (n: number | null | undefined) => (n == null ? "—" : formatCurrency(n));
  const fmtPct = (n: number | null | undefined) =>
    n == null ? "—" : `${(Number(n) > 1 ? n : n * 100).toFixed(2)}%`;

  return (
    <>
      <PageHeader
        title="Campanhas"
        description={useReal ? `Meta · ${meta.selectedAdAccount?.name}` : "Todas as suas campanhas em um único lugar."}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => qc.invalidateQueries({ queryKey: metaKeys.campaigns(meta.organizationId, meta.selectedAdAccount?.id ?? null) })} disabled={!useReal || camps.isFetching}>
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

        {useReal && camps.error && (() => {
          const m = metaErrorMessage(camps.error);
          return (
            <Card className="border-destructive/40 bg-destructive/5 p-3 shadow-card">
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </Card>
          );
        })()}

        <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campanhas..." className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="14d">Últimos 14 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
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
              <SelectItem value="REVIEW">Em análise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Objetivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos objetivos</SelectItem>
              <SelectItem value="LEADS">Leads</SelectItem>
              <SelectItem value="SALES">Vendas</SelectItem>
              <SelectItem value="TRAFFIC">Tráfego</SelectItem>
              <SelectItem value="ENGAGEMENT">Engajamento</SelectItem>
              <SelectItem value="AWARENESS">Reconhecimento</SelectItem>
              <SelectItem value="APP_PROMOTION">App</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={cols.has(c.key)}
                  onCheckedChange={() => toggleCol(c.key)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                    {show("objective") && <TableHead className="text-xs uppercase tracking-wider">Objetivo</TableHead>}
                    {show("dailyBudget") && <TableHead className="text-right text-xs uppercase tracking-wider">Orç. diário</TableHead>}
                    {show("lifetimeBudget") && <TableHead className="text-right text-xs uppercase tracking-wider">Orç. total</TableHead>}
                    {show("budgetRemaining") && <TableHead className="text-right text-xs uppercase tracking-wider">Restante</TableHead>}
                    {show("spend") && <TableHead className="text-right text-xs uppercase tracking-wider">Investimento</TableHead>}
                    {show("impressions") && <TableHead className="text-right text-xs uppercase tracking-wider">Impressões</TableHead>}
                    {show("reach") && <TableHead className="text-right text-xs uppercase tracking-wider">Alcance</TableHead>}
                    {show("clicks") && <TableHead className="text-right text-xs uppercase tracking-wider">Cliques</TableHead>}
                    {show("ctr") && <TableHead className="text-right text-xs uppercase tracking-wider">CTR</TableHead>}
                    {show("cpc") && <TableHead className="text-right text-xs uppercase tracking-wider">CPC</TableHead>}
                    {show("cpm") && <TableHead className="text-right text-xs uppercase tracking-wider">CPM</TableHead>}
                    {show("frequency") && <TableHead className="text-right text-xs uppercase tracking-wider">Freq.</TableHead>}
                    {show("leads") && <TableHead className="text-right text-xs uppercase tracking-wider">Leads</TableHead>}
                    {show("cpl") && <TableHead className="text-right text-xs uppercase tracking-wider">CPL</TableHead>}
                    {show("conversions") && <TableHead className="text-right text-xs uppercase tracking-wider">Conv.</TableHead>}
                    {show("revenue") && <TableHead className="text-right text-xs uppercase tracking-wider">Receita</TableHead>}
                    {show("roas") && <TableHead className="text-right text-xs uppercase tracking-wider">ROAS</TableHead>}
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
                      {show("objective") && <TableCell className="text-sm capitalize">{c.objective || "—"}</TableCell>}
                      {show("dailyBudget") && <TableCell className="text-right text-sm">{c.dailyBudget ? fmtCur(c.dailyBudget) : "—"}</TableCell>}
                      {show("lifetimeBudget") && <TableCell className="text-right text-sm">{fmtCur(c.lifetimeBudget)}</TableCell>}
                      {show("budgetRemaining") && <TableCell className="text-right text-sm">{fmtCur(c.budgetRemaining)}</TableCell>}
                      {show("spend") && <TableCell className="text-right text-sm font-semibold">{fmtCur(c.spend)}</TableCell>}
                      {show("impressions") && <TableCell className="text-right text-sm">{fmtNum(c.impressions)}</TableCell>}
                      {show("reach") && <TableCell className="text-right text-sm">{fmtNum(c.reach)}</TableCell>}
                      {show("clicks") && <TableCell className="text-right text-sm">{fmtNum(c.clicks)}</TableCell>}
                      {show("ctr") && <TableCell className="text-right text-sm">{fmtPct(c.ctr)}</TableCell>}
                      {show("cpc") && <TableCell className="text-right text-sm">{fmtCur(c.cpc)}</TableCell>}
                      {show("cpm") && <TableCell className="text-right text-sm">{fmtCur(c.cpm)}</TableCell>}
                      {show("frequency") && <TableCell className="text-right text-sm">{c.frequency == null ? "—" : c.frequency.toFixed(2)}</TableCell>}
                      {show("leads") && <TableCell className="text-right text-sm font-semibold">{fmtNum(c.leads)}</TableCell>}
                      {show("cpl") && <TableCell className="text-right text-sm">{fmtCur(c.cpl)}</TableCell>}
                      {show("conversions") && <TableCell className="text-right text-sm">{fmtNum(c.conversions)}</TableCell>}
                      {show("revenue") && <TableCell className="text-right text-sm">{fmtCur(c.revenue)}</TableCell>}
                      {show("roas") && <TableCell className="text-right text-sm">{c.roas == null ? "—" : `${c.roas.toFixed(2)}x`}</TableCell>}
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
                            <DropdownMenuItem className="gap-2" asChild>
                              <a href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${meta.selectedAdAccount?.account_id ?? ""}&selected_campaign_ids=${c.id}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" /> Abrir no gerenciador
                              </a>
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
