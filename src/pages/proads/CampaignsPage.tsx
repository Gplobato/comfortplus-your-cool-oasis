import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles, MoreHorizontal, ExternalLink, RefreshCw, SlidersHorizontal, ArrowUpDown } from "lucide-react";
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
import {
  formatCurrency, formatDateTime, formatFreq, formatMetaCurrency, formatMetaNumber,
  formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { toast } from "sonner";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCampaigns, type MetaCampaignRow } from "@/hooks/useMetaData";
import { metaKeys } from "@/lib/metaKeys";
import { metaErrorMessage } from "@/lib/metaErrors";

type Row = MetaCampaignRow & { createdByAI?: boolean };
type SortKey = "spend" | "leads" | "cpm" | "cpl" | "cpr" | "ctr" | "name" | "impressions";

const DATE_PRESETS: Record<string, number> = {
  today: 1, "7d": 7, "14d": 14, "30d": 30, "90d": 90,
};

const ALL_COLS = [
  { key: "objective", label: "Objetivo" },
  { key: "dailyBudget", label: "Orçamento" },
  { key: "lifetimeBudget", label: "Orç. vitalício" },
  { key: "budgetRemaining", label: "Restante" },
  { key: "spend", label: "Investimento" },
  { key: "impressions", label: "Impressões" },
  { key: "reach", label: "Alcance" },
  { key: "clicks", label: "Cliques" },
  { key: "link_clicks", label: "Link clicks" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "frequency", label: "Freq." },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
  { key: "results", label: "Resultados" },
  { key: "cpr", label: "CPR" },
  { key: "conversions", label: "Compras" },
  { key: "revenue", label: "Receita" },
  { key: "roas", label: "ROAS" },
] as const;
type ColKey = typeof ALL_COLS[number]["key"];

const DEFAULT_COLS: ColKey[] = [
  "objective", "dailyBudget", "spend", "impressions", "clicks", "ctr", "cpm", "leads", "cpl", "cpr", "roas",
];

function budgetLabel(c: Row) {
  if (c.budgetLevel === "adset") {
    if (c.dailyBudget) return { value: formatCurrency(c.dailyBudget), hint: "ABO · soma diária" };
    if (c.lifetimeBudget) return { value: formatCurrency(c.lifetimeBudget), hint: "ABO · vitalício" };
    return { value: "—", hint: "Orç. no conjunto" };
  }
  if (c.dailyBudget) return { value: formatCurrency(c.dailyBudget), hint: "CBO · diário" };
  if (c.lifetimeBudget) return { value: formatCurrency(c.lifetimeBudget), hint: "CBO · vitalício" };
  return { value: "—", hint: "Sem orçamento" };
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMetaIntegration();
  const [status, setStatus] = useState<string>("all");
  const [objective, setObjective] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<string>("14d");
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const { dateFrom, dateTo } = useMemo(
    () => periodRange(DATE_PRESETS[datePreset] ?? 14, tz),
    [datePreset, tz],
  );

  const useReal = meta.connected && !!meta.selectedAdAccount;
  const camps = useMetaCampaigns({
    status: status === "all" ? undefined : status,
    objective: objective === "all" ? undefined : objective,
    dateFrom,
    dateTo,
  });

  const items: Row[] = useMemo(() => {
    if (!useReal) return [];
    return (camps.data?.campaigns ?? []) as Row[];
  }, [useReal, camps.data]);

  const filtered = useMemo(() => {
    const list = items.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (platform !== "all" && c.platform !== platform) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name, "pt-BR");
      const av = Number((a as any)[sortKey] ?? 0);
      const bv = Number((b as any)[sortKey] ?? 0);
      return dir * (av - bv);
    });
  }, [items, q, platform, sortKey, sortDir]);

  const totals = useMemo(() => {
    if (useReal && camps.data?.totals && !q && platform === "all") return camps.data.totals;
    const acc = filtered.reduce(
      (t, c) => {
        t.spend += c.spend;
        t.impressions += c.impressions;
        t.reach += c.reach;
        t.clicks += c.clicks;
        t.leads += c.leads;
        t.conversions += c.conversions;
        t.results += c.results ?? 0;
        t.revenue += c.revenue;
        return t;
      },
      { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, conversions: 0, results: 0, revenue: 0,
        cpl: null as number | null, cpr: null as number | null, cpm: null as number | null,
        ctr: null as number | null, roas: null as number | null },
    );
    acc.cpl = acc.leads > 0 ? acc.spend / acc.leads : null;
    acc.cpr = acc.results > 0 ? acc.spend / acc.results : null;
    acc.cpm = acc.impressions > 0 ? (acc.spend / acc.impressions) * 1000 : null;
    acc.ctr = acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : null;
    acc.roas = acc.spend > 0 && acc.revenue > 0 ? acc.revenue / acc.spend : null;
    return acc;
  }, [useReal, camps.data?.totals, filtered, q, platform]);

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

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none text-xs uppercase tracking-wider ${className ?? ""}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-primary" : "opacity-40"}`} />
      </span>
    </TableHead>
  );

  return (
    <>
      <PageHeader
        title="Campanhas"
        description={useReal ? `Meta · ${meta.selectedAdAccount?.name} · ${dateFrom} → ${dateTo}` : "Todas as suas campanhas em um único lugar."}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => qc.invalidateQueries({ queryKey: metaKeys.campaigns(meta.organizationId, meta.selectedAdAccount?.id ?? null) })}
              disabled={!useReal || camps.isFetching}
            >
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
        {!useReal && (
          <Card className="border-warning/40 bg-warning-soft/40 p-4 shadow-card">
            <p className="text-sm font-semibold">
              {meta.connected ? "Selecione uma conta de anúncio" : "Conta Meta não conectada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {meta.connected
                ? "Escolha uma conta de anúncio em Integrações para listar campanhas reais."
                : "Conecte a Meta em Integrações para ver campanhas reais."}
            </p>
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

        {useReal && camps.data?.warnings && camps.data.warnings.length > 0 && (
          <Card className="border-warning/40 bg-warning-soft/30 p-3 text-[11px] shadow-card">
            Aviso Meta: {String(camps.data.warnings[0]).slice(0, 200)}
          </Card>
        )}

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
              <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Escrita na Meta em breve")}>Pausar</Button>
            </div>
          )}
        </Card>

        {useReal && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {[
              { label: "Investimento", value: formatCurrency(totals.spend) },
              { label: "Impressões", value: formatNumber(totals.impressions) },
              { label: "Cliques", value: formatNumber(totals.clicks) },
              { label: "CTR", value: formatMetaPercent(totals.ctr) },
              { label: "CPM", value: formatMetaCurrency(totals.cpm) },
              { label: "Leads", value: formatNumber(totals.leads) },
              { label: "CPL", value: formatMetaCurrency(totals.cpl) },
              { label: "CPR", value: formatMetaCurrency(totals.cpr) },
            ].map((m) => (
              <Card key={m.label} className="p-3 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className="mt-1 font-display text-lg font-bold">{m.value}</p>
              </Card>
            ))}
          </div>
        )}

        <Card className="shadow-card">
          <div className="overflow-x-auto">
            {useReal && camps.isLoading && !filtered.length ? (
              <div className="p-10 text-center text-xs text-muted-foreground">Carregando campanhas da Meta…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {useReal
                  ? "Nenhuma campanha encontrada nesta conta."
                  : meta.connected
                    ? "Selecione uma conta em Integrações."
                    : "Conecte a Meta para listar campanhas."}
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
                    <SortHead k="name">Campanha</SortHead>
                    <TableHead className="text-xs uppercase tracking-wider">Plataforma</TableHead>
                    {show("objective") && <TableHead className="text-xs uppercase tracking-wider">Objetivo</TableHead>}
                    {show("dailyBudget") && <TableHead className="text-right text-xs uppercase tracking-wider">Orçamento</TableHead>}
                    {show("lifetimeBudget") && <TableHead className="text-right text-xs uppercase tracking-wider">Orç. vitalício</TableHead>}
                    {show("budgetRemaining") && <TableHead className="text-right text-xs uppercase tracking-wider">Restante</TableHead>}
                    {show("spend") && <SortHead k="spend" className="text-right">Investimento</SortHead>}
                    {show("impressions") && <SortHead k="impressions" className="text-right">Impressões</SortHead>}
                    {show("reach") && <TableHead className="text-right text-xs uppercase tracking-wider">Alcance</TableHead>}
                    {show("clicks") && <TableHead className="text-right text-xs uppercase tracking-wider">Cliques</TableHead>}
                    {show("link_clicks") && <TableHead className="text-right text-xs uppercase tracking-wider">Link clicks</TableHead>}
                    {show("ctr") && <SortHead k="ctr" className="text-right">CTR</SortHead>}
                    {show("cpc") && <TableHead className="text-right text-xs uppercase tracking-wider">CPC</TableHead>}
                    {show("cpm") && <SortHead k="cpm" className="text-right">CPM</SortHead>}
                    {show("frequency") && <TableHead className="text-right text-xs uppercase tracking-wider">Freq.</TableHead>}
                    {show("leads") && <SortHead k="leads" className="text-right">Leads</SortHead>}
                    {show("cpl") && <SortHead k="cpl" className="text-right">CPL</SortHead>}
                    {show("results") && <TableHead className="text-right text-xs uppercase tracking-wider">Resultados</TableHead>}
                    {show("cpr") && <SortHead k="cpr" className="text-right">CPR</SortHead>}
                    {show("conversions") && <TableHead className="text-right text-xs uppercase tracking-wider">Compras</TableHead>}
                    {show("revenue") && <TableHead className="text-right text-xs uppercase tracking-wider">Receita</TableHead>}
                    {show("roas") && <TableHead className="text-right text-xs uppercase tracking-wider">ROAS</TableHead>}
                    <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Atualizado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const bud = budgetLabel(c);
                    return (
                      <TableRow key={c.id} className="cursor-pointer border-border" onClick={() => navigate(`/campanhas/${c.id}`)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[280px] items-center gap-2">
                            <span className="truncate text-sm font-semibold">{c.name}</span>
                            {c.createdByAI && (
                              <Badge variant="outline" className="gap-1 bg-violet-soft text-violet-soft-foreground">
                                <Sparkles className="h-2.5 w-2.5" /> IA
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><PlatformBadge platform={c.platform as any} /></TableCell>
                        {show("objective") && <TableCell className="text-sm capitalize">{c.objective || "—"}</TableCell>}
                        {show("dailyBudget") && (
                          <TableCell className="text-right text-sm">
                            <div className="leading-tight">
                              <div>{bud.value}</div>
                              <div className="text-[10px] text-muted-foreground">{bud.hint}</div>
                            </div>
                          </TableCell>
                        )}
                        {show("lifetimeBudget") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.lifetimeBudget)}</TableCell>}
                        {show("budgetRemaining") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.budgetRemaining)}</TableCell>}
                        {show("spend") && <TableCell className="text-right text-sm font-semibold">{formatCurrency(c.spend)}</TableCell>}
                        {show("impressions") && <TableCell className="text-right text-sm">{formatMetaNumber(c.impressions)}</TableCell>}
                        {show("reach") && <TableCell className="text-right text-sm">{formatMetaNumber(c.reach)}</TableCell>}
                        {show("clicks") && <TableCell className="text-right text-sm">{formatMetaNumber(c.clicks)}</TableCell>}
                        {show("link_clicks") && <TableCell className="text-right text-sm">{formatMetaNumber(c.link_clicks)}</TableCell>}
                        {show("ctr") && <TableCell className="text-right text-sm">{formatMetaPercent(c.ctr)}</TableCell>}
                        {show("cpc") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpc)}</TableCell>}
                        {show("cpm") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpm)}</TableCell>}
                        {show("frequency") && <TableCell className="text-right text-sm">{formatFreq(c.frequency)}</TableCell>}
                        {show("leads") && <TableCell className="text-right text-sm font-semibold">{formatMetaNumber(c.leads)}</TableCell>}
                        {show("cpl") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpl)}</TableCell>}
                        {show("results") && <TableCell className="text-right text-sm">{formatMetaNumber(c.results)}</TableCell>}
                        {show("cpr") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpr)}</TableCell>}
                        {show("conversions") && <TableCell className="text-right text-sm">{formatMetaNumber(c.conversions)}</TableCell>}
                        {show("revenue") && <TableCell className="text-right text-sm">{formatMetaCurrency(c.revenue)}</TableCell>}
                        {show("roas") && <TableCell className="text-right text-sm">{formatRoas(c.roas)}</TableCell>}
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
                                <a
                                  href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${meta.selectedAdAccount?.account_id ?? ""}&selected_campaign_ids=${c.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Abrir no gerenciador
                                </a>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {useReal && filtered.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              {filtered.length} campanhas · Investimento {formatCurrency(totals.spend)} ·
              CPL {formatMetaCurrency(totals.cpl)} · CPR {formatMetaCurrency(totals.cpr)} ·
              CPM {formatMetaCurrency(totals.cpm)}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
