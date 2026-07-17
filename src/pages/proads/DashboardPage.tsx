import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users2, DollarSign, TrendingUp, Target, MousePointerClick,
  RefreshCw, ArrowRight, BarChart3, RotateCw,
  Eye, Percent, Activity, CircleDollarSign,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
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
import { EmptyState } from "@/components/proads/EmptyState";
import { TrafficManagerChat } from "@/components/proads/TrafficManagerChat";
import { CampaignComparator } from "@/components/proads/CampaignComparator";
import { toast } from "sonner";
import { metaInvalidationKeys } from "@/lib/metaKeys";
import { metaErrorMessage } from "@/lib/metaErrors";

const PERIOD_DAYS: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, today: 1 };

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMetaIntegration();
  const [periodKey, setPeriodKey] = useState<"today" | "7d" | "14d" | "30d">("14d");
  const [chartMode, setChartMode] = useState<"leads" | "spend">("spend");
  const [compareIds, setCompareIds] = useState<string[] | undefined>(undefined);

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const { dateFrom, dateTo } = useMemo(
    () => periodRange(PERIOD_DAYS[periodKey] ?? 14, tz),
    [periodKey, tz],
  );

  const dash = useMetaDashboard({ dateFrom, dateTo });
  const camps = useMetaCampaigns({ status: "ACTIVE", dateFrom, dateTo });

  const useReal = meta.connected && !!meta.selectedAdAccount;
  const summary = dash.data?.summary;
  const deltas = dash.data?.deltas;
  const series = dash.data?.series ?? [];
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
    } catch (e: any) {
      const m = metaErrorMessage(e);
      toast.error(m.title, { id: "meta-sync", description: m.description });
    }
  };

  const dashError = dash.error ? metaErrorMessage(dash.error) : null;
  const delta = (k: keyof NonNullable<typeof deltas>) =>
    typeof deltas?.[k] === "number" ? (deltas![k] as number) : undefined;

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
                    try { await meta.selectAdAccount(v); toast.success("Conta atualizada"); }
                    catch (e: any) {
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

            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as any)}>
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
            <Button size="sm" onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {useReal && summary ? (
            <>
              <MetricCard label="Investimento" value={formatCurrency(summary.spend)} delta={delta("spend")} icon={DollarSign} tone="brand" />
              <MetricCard label="Impressões" value={formatNumber(summary.impressions)} delta={delta("impressions")} icon={Eye} tone="accent" />
              <MetricCard label="Alcance" value={formatNumber(summary.reach)} icon={Users2} tone="accent" />
              <MetricCard label="Cliques" value={formatNumber(summary.clicks)} delta={delta("clicks")} icon={MousePointerClick} tone="brand" />
              <MetricCard label="CTR" value={formatMetaPercent(summary.ctr)} delta={delta("ctr")} icon={Percent} tone="success" />
              <MetricCard label="CPC" value={formatMetaCurrency(summary.cpc)} icon={CircleDollarSign} tone="warning" />
            </>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <MetricCard key={i} label="—" value="—" icon={Activity} />
            ))
          )}
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {useReal && summary ? (
            <>
              <MetricCard label="CPM" value={formatMetaCurrency(summary.cpm)} delta={delta("cpm")} icon={TrendingUp} tone="brand" />
              <MetricCard label="Frequência" value={formatFreq(summary.frequency)} icon={Activity} tone="accent" />
              <MetricCard label="Leads" value={formatNumber(summary.leads)} delta={delta("leads")} icon={Users2} tone="brand" />
              <MetricCard label="CPL" value={formatMetaCurrency(summary.cpl)} delta={delta("cpl")} icon={Target} tone="accent" />
              <MetricCard
                label="CPR"
                value={formatMetaCurrency(summary.cpr)}
                delta={delta("cpr")}
                icon={Target}
                tone="warning"
                deltaLabel={summary.result_type && summary.result_type !== "unknown" ? `por ${summary.result_type}` : undefined}
              />
              <MetricCard label="ROAS" value={formatRoas(summary.roas)} delta={delta("roas")} icon={TrendingUp} tone="success" />
            </>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <MetricCard key={i} label="—" value="—" icon={Activity} />
            ))
          )}
        </div>

        {useReal && summary && (
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {summary.active_campaigns} campanhas ativas
            </Badge>
            <Badge variant="outline" className="font-normal">
              {formatNumber(summary.results)} resultados ({summary.result_type || "—"})
            </Badge>
            <Badge variant="outline" className="font-normal">
              {formatNumber(summary.link_clicks)} link clicks
            </Badge>
            <Badge variant="outline" className="font-normal">
              {formatNumber(summary.conversions)} compras
            </Badge>
            {summary.revenue > 0 && (
              <Badge variant="outline" className="font-normal">
                Receita {formatCurrency(summary.revenue)}
              </Badge>
            )}
            <Badge variant="outline" className="font-normal">
              {dash.data?.period.label}
            </Badge>
          </div>
        )}

        {/* Chart + AI */}
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <Card className="flex h-[560px] max-h-[70vh] flex-col p-5 shadow-card lg:col-span-2 lg:h-[600px]">
            <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold">Desempenho</h3>
                <p className="text-xs text-muted-foreground">
                  {useReal
                    ? `${dash.data?.period.label ?? ""} · ${meta.selectedAdAccount?.name ?? ""}`
                    : "Conecte a Meta para ver a série diária"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={chartMode} onValueChange={(v) => setChartMode(v as any)}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spend">Investimento + CPM</SelectItem>
                    <SelectItem value="leads">Leads + CPL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="min-h-0 w-full flex-1">
              {useReal ? (
                dash.isLoading && !series.length ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando…</div>
                ) : series.length ? (
                  <ResponsiveContainer>
                    <ComposedChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: any, name: string) => {
                          if (name === "spend" || name === "cpl" || name === "cpm" || name === "cpr") {
                            return [formatCurrency(Number(value) || 0), name.toUpperCase()];
                          }
                          return [formatNumber(Number(value) || 0), name];
                        }}
                        labelFormatter={(l) => formatDate(String(l))}
                      />
                      <Legend />
                      {chartMode === "spend" ? (
                        <>
                          <Area yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="cpm" name="CPM" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                        </>
                      ) : (
                        <>
                          <Area yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                        </>
                      )}
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
          </Card>

          <TrafficManagerChat
            dateFrom={dateFrom}
            dateTo={dateTo}
            compareCampaignIds={compareIds}
            onConsumeCompare={() => setCompareIds(undefined)}
          />
        </div>

        <CampaignComparator
          dateFrom={dateFrom}
          dateTo={dateTo}
          onAskManager={(ids) => setCompareIds(ids)}
        />

        {/* Active Campaigns */}
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
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">CPR</TableHead>
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
                        <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpl)}</TableCell>
                        <TableCell className="text-right text-sm">{formatMetaCurrency(c.cpr)}</TableCell>
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
