import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users2, DollarSign, TrendingUp, Target, MousePointerClick, Megaphone,
  RefreshCw, ArrowRight, BarChart3, RotateCw,
  Eye, Percent, Activity, CircleDollarSign,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { MetricCard } from "@/components/proads/MetricCard";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  formatCurrency, formatDate, formatDateTime, formatFreq, formatMetaCurrency,
  formatMetaNumber, formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaDashboard, useMetaCampaigns } from "@/hooks/useMetaData";
import { useMetaGeo } from "@/hooks/useMetaGeo";
import { WorldReachMap } from "@/components/proads/WorldReachMap";
import { EmptyState } from "@/components/proads/EmptyState";
import { TrafficManagerPanel } from "@/components/proads/TrafficManagerPanel";
import { CampaignComparator } from "@/components/proads/CampaignComparator";
import { toast } from "sonner";
import { metaInvalidationKeys } from "@/lib/metaKeys";
import { metaErrorMessage } from "@/lib/metaErrors";

const PERIOD_DAYS: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, today: 1 };

function safeMetric(value: number | null | undefined, formatter: (n: number) => string, empty = "—") {
  if (value == null || !Number.isFinite(value)) return empty;
  return formatter(value);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMetaIntegration();
  const [periodKey, setPeriodKey] = useState<"today" | "7d" | "14d" | "30d">("14d");
  const [compareIds, setCompareIds] = useState<string[] | undefined>(undefined);

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const { dateFrom, dateTo } = useMemo(
    () => periodRange(PERIOD_DAYS[periodKey] ?? 14, tz),
    [periodKey, tz],
  );

  const dash = useMetaDashboard({ dateFrom, dateTo });
  const camps = useMetaCampaigns({ status: "ACTIVE", dateFrom, dateTo });
  const geo = useMetaGeo({ dateFrom, dateTo, breakdown: "country" });
  const [geoMetric, setGeoMetric] = useState<"impressions" | "reach" | "clicks" | "leads">("impressions");

  const useReal = meta.connected && !!meta.selectedAdAccount;
  const summary = dash.data?.summary;
  const deltas = dash.data?.deltas;
  const series = useMemo(() => {
    const raw = dash.data?.series ?? [];
    if (!raw.length || !dateFrom || !dateTo) return raw;
    const byDate = new Map(raw.map((point) => [point.date, point]));
    const filled: typeof raw = [];
    const cursor = new Date(`${dateFrom}T12:00:00`);
    const end = new Date(`${dateTo}T12:00:00`);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      filled.push(
        byDate.get(key) ?? {
          date: key,
          spend: 0,
          leads: 0,
          cpl: null,
          ctr: null,
          impressions: 0,
          clicks: 0,
          cpm: null,
          cpc: null,
          results: 0,
          cpr: null,
        },
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    return filled;
  }, [dash.data?.series, dateFrom, dateTo]);
  const activeCampaigns = useMemo(() => {
    const list = camps.data?.campaigns ?? [];
    return [...list].sort((a, b) => b.spend - a.spend);
  }, [camps.data?.campaigns]);

  const metaChip = (() => {
    if (meta.loading) return { label: "Meta • Carregando…", color: "bg-muted-foreground" };
    if (!meta.connected) return { label: "Meta • Não conectada", color: "bg-muted-foreground" };
    if (!meta.selectedAdAccount) return { label: "Meta • Selecione uma conta", color: "bg-warning" };
    return { label: `Meta • ${meta.selectedAdAccount.name}`, color: "bg-success" };
  })();

  const onRefresh = async () => {
    if (useReal) {
      await Promise.all(
        metaInvalidationKeys(meta.organizationId).map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      toast.success("Dados atualizados");
    } else {
      toast.info("Conecte a Meta para atualizar métricas");
    }
  };

  const onSync = async () => {
    if (!meta.connected) {
      const m = metaErrorMessage("token_expired");
      toast.error(m.title, { description: m.description });
      return;
    }
    toast.loading("Sincronizando com Meta...", { id: "meta-sync" });
    try {
      await meta.sync();
      toast.success("Sincronização concluída", { id: "meta-sync" });
    } catch (e) {
      const m = metaErrorMessage(e);
      toast.error(m.title, { id: "meta-sync", description: m.description });
    }
  };

  const dashError = dash.error ? metaErrorMessage(dash.error) : null;
  const delta = (k: keyof NonNullable<typeof deltas>) =>
    typeof deltas?.[k] === "number" && Number.isFinite(deltas[k] as number)
      ? (deltas![k] as number)
      : undefined;

  return (
    <>
      <PageHeader
        title="Visão Geral"
        description="Métricas reais da conta Meta selecionada."
        actions={
          <>
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1877F2] text-[10px] font-bold text-white">f</span>
              <div className="hidden leading-tight sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conta Meta</p>
                <p className="flex items-center gap-1 text-[11px] font-semibold">
                  <span className={`h-1.5 w-1.5 rounded-full ${metaChip.color}`} />
                  {metaChip.label}
                </p>
              </div>
              {meta.availableAdAccounts.length > 1 && meta.connected ? (
                <Select
                  value={meta.selectedAdAccount?.id ?? ""}
                  onValueChange={async (v) => {
                    try {
                      await meta.selectAdAccount(v);
                      toast.success("Conta atualizada");
                    } catch (e) {
                      const m = metaErrorMessage(e);
                      toast.error(m.title, { description: m.description });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-[160px] border-0 bg-transparent text-[11px]">
                    <SelectValue placeholder="Trocar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.availableAdAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => navigate("/integracoes")}>
                  {meta.connected ? "Ver" : "Conectar"} <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as typeof periodKey)}>
              <SelectTrigger className="h-9 w-[150px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="14d">Últimos 14 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onRefresh} disabled={dash.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${dash.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              className="h-9 gap-2 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={onSync}
              disabled={!meta.connected}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Sincronizar Meta
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        {!meta.connected && (
          <Card className="flex items-center justify-between border-border bg-card p-4 shadow-card">
            <div>
              <p className="text-sm font-semibold">Conecte sua conta Meta</p>
              <p className="text-xs text-muted-foreground">
                Integre a Meta Ads para ver métricas e campanhas reais neste painel.
              </p>
            </div>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => navigate("/integracoes")}>
              Ir para Integrações
            </Button>
          </Card>
        )}

        {meta.connected && !meta.selectedAdAccount && (
          <Card className="flex items-center justify-between border-warning/40 bg-warning-soft/40 p-4 shadow-card">
            <div>
              <p className="text-sm font-semibold">Selecione uma conta de anúncio</p>
              <p className="text-xs text-muted-foreground">
                A Meta está conectada, mas nenhuma conta de anúncio foi escolhida ainda.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
          </Card>
        )}

        {dashError && useReal && (
          <Card className="border-destructive/40 bg-destructive/5 p-3 shadow-card">
            <p className="text-sm font-semibold">{dashError.title}</p>
            <p className="text-xs text-muted-foreground">{dashError.description}</p>
          </Card>
        )}

        {dash.data?.warnings && dash.data.warnings.length > 0 && (
          <Card className="border-warning/40 bg-warning-soft/30 p-3 text-[11px] text-warning-foreground shadow-card">
            {metaErrorMessage(dash.data.warnings[0]).description}
          </Card>
        )}

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {useReal && summary ? (
            <>
              <MetricCard label="Investimento" value={safeMetric(summary.spend, formatCurrency)} delta={delta("spend")} icon={DollarSign} tone="brand" />
              <MetricCard label="Leads" value={safeMetric(summary.leads, formatNumber)} delta={delta("leads")} icon={Users2} tone="success" />
              <MetricCard
                label="CPL"
                value={summary.leads > 0 ? safeMetric(summary.cpl, formatMetaCurrency) : "—"}
                delta={delta("cpl")}
                icon={Target}
                tone="brand"
                hint="Custo por lead. Só existe quando há leads no período."
              />
              <MetricCard
                label="ROAS"
                value={summary.revenue > 0 ? safeMetric(summary.roas, formatRoas) : "—"}
                delta={delta("roas")}
                icon={TrendingUp}
                tone="success"
                hint="Retorno sobre investimento com receita rastreada."
              />
              <MetricCard
                label="Campanhas ativas"
                value={safeMetric(summary.active_campaigns, formatNumber)}
                icon={Megaphone}
                tone="brand"
              />
            </>
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <MetricCard key={i} label="—" value="—" icon={Activity} />
            ))
          )}
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
          {useReal && summary ? (
            <>
              <MetricCard size="sm" label="Impressões" value={safeMetric(summary.impressions, formatNumber)} icon={Eye} tone="brand" />
              <MetricCard size="sm" label="Alcance" value={safeMetric(summary.reach, formatNumber)} icon={Users2} tone="brand" />
              <MetricCard size="sm" label="Cliques" value={safeMetric(summary.clicks, formatNumber)} icon={MousePointerClick} tone="brand" />
              <MetricCard size="sm" label="CTR" value={safeMetric(summary.ctr, (n) => formatMetaPercent(n))} icon={Percent} tone="success" />
              <MetricCard size="sm" label="CPC" value={safeMetric(summary.cpc, formatMetaCurrency)} icon={CircleDollarSign} tone="brand" />
              <MetricCard size="sm" label="CPM" value={safeMetric(summary.cpm, formatMetaCurrency)} icon={TrendingUp} tone="brand" />
              <MetricCard size="sm" label="Frequência" value={safeMetric(summary.frequency, formatFreq)} icon={Activity} tone="warning" />
            </>
          ) : (
            Array.from({ length: 7 }).map((_, i) => (
              <MetricCard key={i} size="sm" label="—" value="—" icon={Activity} />
            ))
          )}
        </div>

        {useReal && summary && (
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="font-normal">{dash.data?.period.label}</Badge>
            <Badge variant="outline" className="font-normal">
              {formatMetaNumber(summary.link_clicks)} cliques no link
            </Badge>
            <Badge variant="outline" className="font-normal">
              {formatMetaNumber(summary.results)} resultados
            </Badge>
          </div>
        )}

        {/* Chart + World map split */}
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="p-5 shadow-card lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold">Desempenho diário</h3>
                <p className="text-xs text-muted-foreground">
                  {useReal
                    ? `${dash.data?.period.label ?? ""} · barras de investimento e linha de leads`
                    : "Conecte a Meta para ver a série diária"}
                </p>
              </div>
            </div>
            <div className="h-56 w-full md:h-64">
              {useReal ? (
                dash.isLoading && !series.length ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando…</div>
                ) : series.length ? (
                  <ResponsiveContainer>
                    <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={28}
                      />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as {
                            spend?: number;
                            leads?: number;
                            cpl?: number | null;
                            ctr?: number | null;
                          };
                          return (
                            <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
                              <p className="mb-1.5 font-semibold">{formatDate(String(label))}</p>
                              <p>Investimento: {safeMetric(row.spend, formatCurrency)}</p>
                              <p>Leads: {safeMetric(row.leads, formatNumber)}</p>
                              <p>CPL: {row.leads && row.leads > 0 ? safeMetric(row.cpl, formatMetaCurrency) : "—"}</p>
                              <p>CTR: {safeMetric(row.ctr, (v) => formatMetaPercent(v))}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="spend"
                        name="Investimento"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="leads"
                        name="Leads"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "hsl(var(--accent))" }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState icon={BarChart3} title="Sem dados no período" description="Nenhuma métrica retornada pela Meta para esta janela." />
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={BarChart3}
                    title="Conta Meta não conectada"
                    description="Conecte sua conta Meta em Integrações para ver métricas reais."
                  />
                </div>
              )}
            </div>
            {useReal && series.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tooltip com data, investimento, leads, CPL e CTR ao passar o mouse em cada dia.
              </p>
            )}
          </Card>

          {/* World reach map */}
          <Card className="overflow-hidden border-white/5 bg-slate-950 p-0 shadow-card lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4">
              <div>
                <h3 className="font-display font-bold text-white">Alcance global</h3>
                <p className="text-[11px] text-white/60">
                  {useReal
                    ? "Onde seus anúncios estão sendo entregues"
                    : "Conecte a Meta para ver a distribuição geográfica"}
                </p>
              </div>
              <Select value={geoMetric} onValueChange={(v) => setGeoMetric(v as typeof geoMetric)}>
                <SelectTrigger className="h-8 w-[130px] border-white/10 bg-white/5 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Impressões</SelectItem>
                  <SelectItem value="reach">Alcance</SelectItem>
                  <SelectItem value="clicks">Cliques</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[280px] w-full md:h-[320px]">
              <WorldReachMap
                points={geo.data?.points ?? []}
                metric={geoMetric}
                loading={geo.isLoading}
              />
            </div>
          </Card>
        </div>


        <TrafficManagerPanel
          dateFrom={dateFrom}
          dateTo={dateTo}
          compareCampaignIds={compareIds}
          onConsumeCompare={() => setCompareIds(undefined)}
        />

        <CampaignComparator
          dateFrom={dateFrom}
          dateTo={dateTo}
          onAskManager={(ids) => setCompareIds(ids)}
        />

        <Card className="shadow-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h3 className="font-display font-bold">Campanhas ativas</h3>
              {useReal && meta.lastSyncAt && (
                <p className="text-[11px] text-muted-foreground">Última sinc: {formatDateTime(meta.lastSyncAt)}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/campanhas")}>
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            {useReal ? (
              camps.isLoading && !activeCampaigns.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando…</div>
              ) : activeCampaigns.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma campanha ativa nesta conta.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Campanha</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Invest.</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">CPM</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">CTR</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Leads</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">CPL</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCampaigns.slice(0, 8).map((c) => (
                      <TableRow key={c.id} className="cursor-pointer border-border" onClick={() => navigate(`/campanhas/${c.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlatformBadge platform="meta" showLabel={false} />
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-medium">{c.name}</span>
                              <span className="text-[10px] capitalize text-muted-foreground">{c.objective || "—"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatCurrency(c.spend)}</TableCell>
                        <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpm)}</TableCell>
                        <TableCell className="text-right text-sm">{formatMetaPercent(c.ctr)}</TableCell>
                        <TableCell className="text-right text-sm">{formatMetaNumber(c.leads)}</TableCell>
                        <TableCell className="text-right text-sm">{c.leads > 0 ? formatMetaCurrency(c.cpl) : "—"}</TableCell>
                        <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {meta.connected ? "Selecione uma conta em Integrações." : "Conecte a Meta para listar campanhas ativas."}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
