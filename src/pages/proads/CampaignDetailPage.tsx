import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Pause, Play, Copy, ExternalLink, DollarSign, MousePointerClick,
  Target, Users2, Eye, Percent, TrendingUp, Activity, ImageIcon,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { MetricCard } from "@/components/proads/MetricCard";
import { EmptyState } from "@/components/proads/EmptyState";
import { HierarchyMetricsTable } from "@/components/proads/HierarchyMetricsTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatCurrency, formatDate, formatFreq, formatMetaCurrency, formatMetaNumber,
  formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCampaignDetail } from "@/hooks/useMetaData";
import { toast } from "sonner";

const PERIOD_DAYS: Record<string, number> = { today: 1, "7d": 7, "14d": 14, "30d": 30 };

function goalLabel(raw: string | null | undefined) {
  if (!raw) return "—";
  return raw.toLowerCase().replace(/_/g, " ");
}

export default function CampaignDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const meta = useMetaIntegration();
  const [periodKey, setPeriodKey] = useState<"today" | "7d" | "14d" | "30d">("14d");
  const [adsetStatus, setAdsetStatus] = useState<string>("all");
  const [adStatus, setAdStatus] = useState<string>("all");
  const [selectedAdsetId, setSelectedAdsetId] = useState<string>("all");

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const { dateFrom, dateTo } = useMemo(
    () => periodRange(PERIOD_DAYS[periodKey] ?? 14, tz),
    [periodKey, tz],
  );

  const useReal = meta.connected && !!meta.selectedAdAccount && !!id;
  const detail = useMetaCampaignDetail(useReal ? id : undefined, { dateFrom, dateTo });
  const c = detail.data?.campaign;
  const series = detail.data?.series ?? [];
  const adsets = detail.data?.adsets ?? [];
  const ads = detail.data?.ads ?? [];
  const warnings = detail.data?.warnings ?? [];
  const requestId = detail.data?.request_id;

  const filteredAdsets = useMemo(() => {
    return adsets.filter((a) => adsetStatus === "all" || a.status === adsetStatus);
  }, [adsets, adsetStatus]);

  const filteredAds = useMemo(() => {
    return ads.filter((a) => {
      if (adStatus !== "all" && a.status !== adStatus) return false;
      if (selectedAdsetId !== "all" && a.adset_id !== selectedAdsetId) return false;
      return true;
    });
  }, [ads, adStatus, selectedAdsetId]);

  const adsetNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of adsets) m.set(a.id, a.name);
    return m;
  }, [adsets]);

  if (useReal && detail.isLoading && !c) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando campanha da Meta…</div>;
  }

  if (useReal && (detail.error || !c)) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/campanhas")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <EmptyState
          icon={Activity}
          title="Campanha não encontrada"
          description="Não foi possível carregar os dados reais desta campanha na Meta."
        />
      </div>
    );
  }

  if (!useReal) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/campanhas")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <EmptyState
          icon={Activity}
          title="Conecte a Meta"
          description="O detalhe da campanha agora usa dados reais. Conecte a conta em Integrações."
        />
        <Button onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
      </div>
    );
  }

  const actId = meta.selectedAdAccount?.account_id ?? "";

  return (
    <>
      <PageHeader
        title={c!.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <PlatformBadge platform="meta" />
            <CampaignStatusBadge status={c!.status} />
            <span className="capitalize">{c!.objective || "—"}</span>
            <span>· {dateFrom} → {dateTo}</span>
            <span>· {adsets.length} conjuntos · {ads.length} anúncios</span>
          </span>
        }
        actions={
          <>
            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as any)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="14d">Últimos 14 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Escrita na Meta em breve")}>
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </Button>
            {c!.status === "ACTIVE" ? (
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Escrita na Meta em breve")}>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            ) : (
              <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground" onClick={() => toast.info("Escrita na Meta em breve")}>
                <Play className="h-3.5 w-3.5" /> Ativar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <a
                href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${c!.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        {warnings.length > 0 && (
          <Card className="border-warning/40 bg-warning-soft/30 p-3 text-[11px] shadow-card">
            Aviso Meta: {String(warnings[0]).slice(0, 240)}
            {requestId && <span className="ml-2 text-muted-foreground">request_id: {requestId}</span>}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Investimento" value={formatCurrency(c!.spend)} icon={DollarSign} />
          <MetricCard label="Impressões" value={formatNumber(c!.impressions)} icon={Eye} tone="accent" />
          <MetricCard label="Cliques" value={formatNumber(c!.clicks)} icon={MousePointerClick} />
          <MetricCard label="CTR" value={formatMetaPercent(c!.ctr)} icon={Percent} tone="success" />
          <MetricCard label="CPM" value={formatMetaCurrency(c!.cpm)} icon={TrendingUp} tone="brand" />
          <MetricCard label="Leads" value={formatNumber(c!.leads)} icon={Users2} />
          <MetricCard label="CPL" value={formatMetaCurrency(c!.cpl)} icon={Target} tone="accent" />
          <MetricCard label="CPR" value={formatMetaCurrency(c!.cpr)} icon={Target} tone="warning" />
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge variant="outline">
            Orçamento:{" "}
            {c!.dailyBudget
              ? `${formatCurrency(c!.dailyBudget)}/dia`
              : c!.lifetimeBudget
                ? `${formatCurrency(c!.lifetimeBudget)} vitalício`
                : "—"}
            {c!.budgetLevel === "adset" ? " (ABO)" : c!.budgetLevel === "campaign" ? " (CBO)" : ""}
          </Badge>
          <Badge variant="outline">Alcance {formatNumber(c!.reach)}</Badge>
          <Badge variant="outline">Freq. {formatFreq(c!.frequency)}</Badge>
          <Badge variant="outline">CPC {formatMetaCurrency(c!.cpc)}</Badge>
          <Badge variant="outline">ROAS {formatRoas(c!.roas)}</Badge>
          <Badge variant="outline">
            Resultados {formatMetaNumber(c!.results)} ({c!.result_type || "—"})
          </Badge>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-card">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="adsets">Conjuntos ({adsets.length})</TabsTrigger>
            <TabsTrigger value="ads">Anúncios ({ads.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="p-5 shadow-card">
              <div className="mb-4">
                <h3 className="font-display font-bold">Desempenho diário</h3>
                <p className="text-xs text-muted-foreground">Dados ao vivo da Marketing API</p>
              </div>
              <div className="h-80 w-full">
                {series.length === 0 ? (
                  <EmptyState icon={Activity} title="Sem série no período" description="Nenhum insight diário retornado." />
                ) : (
                  <ResponsiveContainer>
                    <ComposedChart data={series}>
                      <defs>
                        <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: any, name: string) => {
                          if (["spend", "cpl", "cpm", "cpr"].includes(name)) return [formatCurrency(Number(value) || 0), name.toUpperCase()];
                          return [formatNumber(Number(value) || 0), name];
                        }}
                      />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="hsl(var(--primary))" fill="url(#gSpend)" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="cpm" name="CPM" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <Card className="p-5 shadow-card">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Investimento", formatCurrency(c!.spend)],
                  ["Impressões", formatNumber(c!.impressions)],
                  ["Alcance", formatNumber(c!.reach)],
                  ["Cliques", formatNumber(c!.clicks)],
                  ["Link clicks", formatMetaNumber(c!.link_clicks)],
                  ["CTR", formatMetaPercent(c!.ctr)],
                  ["CPC", formatMetaCurrency(c!.cpc)],
                  ["CPM", formatMetaCurrency(c!.cpm)],
                  ["Frequência", formatFreq(c!.frequency)],
                  ["Leads", formatNumber(c!.leads)],
                  ["CPL", formatMetaCurrency(c!.cpl)],
                  ["Resultados", formatMetaNumber(c!.results)],
                  ["CPR", formatMetaCurrency(c!.cpr)],
                  ["Compras", formatNumber(c!.conversions)],
                  ["Receita", formatMetaCurrency(c!.revenue)],
                  ["ROAS", formatRoas(c!.roas)],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 font-display text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="adsets" className="mt-4 space-y-3">
            <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
              <p className="text-sm font-semibold">Conjuntos de anúncios</p>
              <Select value={adsetStatus} onValueChange={setAdsetStatus}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="PAUSED">Pausados</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivados</SelectItem>
                  <SelectItem value="REVIEW">Em análise</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{filteredAdsets.length} de {adsets.length}</span>
            </Card>
            <Card className="shadow-card">
              <HierarchyMetricsTable
                showBudget
                emptyLabel="Nenhum conjunto nesta campanha."
                rows={filteredAdsets.map((a) => ({
                  id: a.id,
                  name: a.name,
                  status: a.status,
                  spend: a.spend,
                  impressions: a.impressions,
                  clicks: a.clicks,
                  ctr: a.ctr,
                  cpm: a.cpm,
                  cpc: a.cpc,
                  frequency: a.frequency,
                  leads: a.leads,
                  cpl: a.cpl,
                  results: a.results,
                  cpr: a.cpr,
                  roas: a.roas,
                  dailyBudget: a.dailyBudget,
                  subtitle: `${a.targeting_summary} · otimização: ${goalLabel(a.optimization_goal)}`,
                }))}
              />
            </Card>
          </TabsContent>

          <TabsContent value="ads" className="mt-4 space-y-3">
            <Card className="flex flex-wrap items-center gap-3 p-3 shadow-card">
              <p className="text-sm font-semibold">Anúncios</p>
              <Select value={adStatus} onValueChange={setAdStatus}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="PAUSED">Pausados</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivados</SelectItem>
                  <SelectItem value="REVIEW">Em análise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedAdsetId} onValueChange={setSelectedAdsetId}>
                <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Conjunto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os conjuntos</SelectItem>
                  {adsets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{filteredAds.length} de {ads.length}</span>
            </Card>
            <Card className="shadow-card">
              <HierarchyMetricsTable
                emptyLabel="Nenhum anúncio nesta campanha."
                rows={filteredAds.map((a) => ({
                  id: a.id,
                  name: a.name,
                  status: a.status,
                  spend: a.spend,
                  impressions: a.impressions,
                  clicks: a.clicks,
                  ctr: a.ctr,
                  cpm: a.cpm,
                  cpc: a.cpc,
                  frequency: a.frequency,
                  leads: a.leads,
                  cpl: a.cpl,
                  results: a.results,
                  cpr: a.cpr,
                  roas: a.roas,
                  subtitle: [
                    a.adset_id ? adsetNameById.get(a.adset_id) : null,
                    a.creative?.title || a.creative?.cta || a.creative?.object_type,
                  ].filter(Boolean).join(" · "),
                  leading: a.creative?.thumbnail_url ? (
                    <img
                      src={a.creative.thumbnail_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover bg-muted"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ),
                }))}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
