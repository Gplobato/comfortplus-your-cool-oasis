import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Sparkles, ExternalLink, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { MetricCard } from "@/components/proads/MetricCard";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/proads/Badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatCurrency, formatDate, formatMetaCurrency, formatMetaNumber, formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCreatives } from "@/hooks/useMetaData";
import { DollarSign, Eye, MousePointerClick, Target, Percent, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";

export default function CreativeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const meta = useMetaIntegration();
  const [periodKey, setPeriodKey] = useState("30d");

  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const days = periodKey === "7d" ? 7 : periodKey === "14d" ? 14 : periodKey === "90d" ? 90 : 30;
  const { dateFrom, dateTo } = useMemo(() => periodRange(days, tz), [days, tz]);

  const query = useMetaCreatives({ dateFrom, dateTo, sync: false });
  const c = useMemo(
    () => (query.data?.creatives ?? []).find(
      (x) => x.id === id || x.db_id === id || x.meta_creative_id === id || `meta_${x.meta_creative_id}` === id,
    ),
    [query.data?.creatives, id],
  );

  if (query.isLoading && !c) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando criativo…</div>;
  }

  if (!c) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/criativos")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <EmptyState
          icon={ImageIcon}
          title="Criativo não encontrado"
          description="Pode ter saído da conta Meta ou ainda não foi sincronizado."
        />
      </div>
    );
  }

  const perf = c.performance ?? {
    spend: 0, impressions: 0, clicks: 0, leads: 0, ctr: null, cpm: null, cpl: null, cpr: null, roas: null, results: 0,
  };
  const actId = meta.selectedAdAccount?.account_id ?? "";

  return (
    <>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {c.source === "meta" ? <PlatformBadge platform="meta" /> : (
              <Badge className="gap-1 bg-gradient-brand text-white"><Sparkles className="h-3 w-3" /> IA</Badge>
            )}
            <Badge variant="outline">{c.status === "in_use" ? "Em uso" : c.status === "used" ? "Usado" : c.status}</Badge>
            <span>{c.format || c.type}</span>
            {c.source === "meta" && (
              <span>· {c.active_ads_count}/{c.ads_count} anúncios ativos</span>
            )}
          </span>
        }
        actions={
          <>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="14d">14 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Em breve")}>
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </Button>
            <Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground" onClick={() => navigate("/agente")}>
              <Sparkles className="h-3.5 w-3.5" /> Criar variação
            </Button>
            {c.meta_creative_id && (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a
                  href={`https://www.facebook.com/adsmanager/manage/ads?act=${actId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Investimento" value={formatCurrency(perf.spend)} icon={DollarSign} />
          <MetricCard label="Impressões" value={formatNumber(perf.impressions)} icon={Eye} tone="accent" />
          <MetricCard label="Cliques" value={formatNumber(perf.clicks)} icon={MousePointerClick} />
          <MetricCard label="CTR" value={formatMetaPercent(perf.ctr)} icon={Percent} tone="success" />
          <MetricCard label="CPM" value={formatMetaCurrency(perf.cpm)} icon={TrendingUp} />
          <MetricCard label="Leads" value={formatNumber(perf.leads)} icon={Users2} />
          <MetricCard label="CPL" value={formatMetaCurrency(perf.cpl)} icon={Target} tone="accent" />
          <MetricCard label="CPR" value={formatMetaCurrency(perf.cpr)} icon={Target} tone="warning" />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="overflow-hidden shadow-card md:col-span-2">
            {c.thumbnail_url || c.media_url ? (
              <img src={c.media_url || c.thumbnail_url || ""} alt={c.name} className="w-full bg-muted object-contain" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="p-4 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Informações</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Origem</span>
                  <span className="font-medium">{c.source === "meta" ? "Meta Ads" : c.source === "ai" ? "Gerado por IA" : "Upload"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="capitalize">{c.type}</span>
                </div>
                {c.meta_creative_id && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">ID Meta</span>
                    <span className="truncate font-mono text-[11px]">{c.meta_creative_id}</span>
                  </div>
                )}
                {c.created_at && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Criado</span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Anúncios</span>
                  <span>{c.active_ads_count} ativos / {c.ads_count} total</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">ROAS</span>
                  <span>{formatRoas(perf.roas)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Resultados</span>
                  <span>{formatMetaNumber(perf.results)}</span>
                </div>
              </div>
            </Card>

            {(c.headline || c.primary_text || c.cta) && (
              <Card className="p-4 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Textos do anúncio</p>
                <div className="mt-3 space-y-2 text-sm">
                  {c.headline && <div><span className="text-muted-foreground">Título:</span> <strong>{c.headline}</strong></div>}
                  {c.primary_text && <div><span className="text-muted-foreground">Texto:</span> {c.primary_text}</div>}
                  {c.cta && <div><span className="text-muted-foreground">CTA:</span> <Badge variant="outline">{c.cta}</Badge></div>}
                </div>
              </Card>
            )}

            {c.ad_names && c.ad_names.length > 0 && (
              <Card className="p-4 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Anúncios vinculados</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {c.ad_names.map((n) => (
                    <li key={n} className="truncate text-muted-foreground">• {n}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
