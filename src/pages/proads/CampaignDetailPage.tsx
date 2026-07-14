import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, Copy, Archive, ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { MetricCard } from "@/components/proads/MetricCard";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyticsService, campaignService } from "@/services";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Campaign, MetricPoint } from "@/types/proads";
import { DollarSign, MousePointerClick, Target, Users2 } from "lucide-react";
import { toast } from "sonner";

export default function CampaignDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Campaign | undefined>();
  const [series, setSeries] = useState<MetricPoint[]>([]);

  useEffect(() => {
    campaignService.get(id).then(setC);
    analyticsService.overview().then(setSeries);
  }, [id]);

  if (!c) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <>
      <PageHeader
        title={c.name}
        description={
          <span className="flex items-center gap-3 text-sm">
            <PlatformBadge platform={c.platform} /> · <CampaignStatusBadge status={c.status} /> ·{" "}
            <span className="capitalize text-muted-foreground">{c.objective}</span>
          </span> as any
        }
        actions={
          <>
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.success("Duplicada")}>
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </Button>
            {c.status === "ACTIVE" ? (
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Pausada")}>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            ) : (
              <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground" onClick={() => toast.info("Aguardando aprovação")}>
                <Play className="h-3.5 w-3.5" /> Ativar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9"><ExternalLink className="h-4 w-4" /></Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Leads" value={formatNumber(c.leads)} delta={12.5} icon={Users2} />
          <MetricCard label="CPL" value={formatCurrency(c.cpl)} delta={-4.2} icon={Target} tone="accent" />
          <MetricCard label="Investimento" value={formatCurrency(c.spend)} delta={8.1} icon={DollarSign} />
          <MetricCard label="ROAS" value={`${c.roas.toFixed(2)}x`} delta={5.4} icon={MousePointerClick} tone="success" />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-card">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="adsets">Conjuntos</TabsTrigger>
            <TabsTrigger value="ads">Anúncios</TabsTrigger>
            <TabsTrigger value="creatives">Criativos</TabsTrigger>
            <TabsTrigger value="audience">Público</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="ai">Sugestões da IA</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card className="p-5 shadow-card">
              <div className="mb-4">
                <h3 className="font-display font-bold">Desempenho ao longo do tempo</h3>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>
          {["adsets", "ads", "creatives", "audience", "metrics", "history", "ai"].map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              <EmptyState
                title="Em construção"
                description="Esta aba será populada quando os conectores estiverem ativos."
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
