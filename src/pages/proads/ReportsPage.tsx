import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Download, Mail, FileText, Clock, DollarSign, Target, TrendingUp, Users2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { MetricCard } from "@/components/proads/MetricCard";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatCompactCurrency, formatCurrency, formatMetaCurrency, formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { periodRange } from "@/lib/dates";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCampaigns, useMetaDashboard } from "@/hooks/useMetaData";
import { toast } from "sonner";

export default function ReportsPage() {
  const navigate = useNavigate();
  const meta = useMetaIntegration();
  const [periodKey, setPeriodKey] = useState("30");
  const tz = meta.selectedAdAccount?.timezone || "America/Sao_Paulo";
  const days = periodKey === "7" ? 7 : periodKey === "90" ? 90 : 30;
  const { dateFrom, dateTo } = useMemo(() => periodRange(days, tz), [days, tz]);
  const useReal = meta.connected && !!meta.selectedAdAccount;

  const dash = useMetaDashboard({ dateFrom, dateTo });
  const camps = useMetaCampaigns({ dateFrom, dateTo, status: "all" });
  const summary = dash.data?.summary;
  const deltas = dash.data?.deltas;
  const campaigns = camps.data?.campaigns ?? [];

  const byPlatform = useMemo(() => {
    const spend = summary?.spend ?? 0;
    const leads = summary?.leads ?? 0;
    return [
      {
        platform: "Meta",
        spend,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
      },
    ];
  }, [summary]);

  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.spend > 0)
      .sort((a, b) => (a.cpl ?? Number.POSITIVE_INFINITY) - (b.cpl ?? Number.POSITIVE_INFINITY))
      .slice(0, 5);
  }, [campaigns]);

  const topByCtr = useMemo(() => {
    return [...campaigns]
      .filter((c) => (c.impressions ?? 0) > 0 && c.ctr != null)
      .sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0))
      .slice(0, 5);
  }, [campaigns]);

  const delta = (key: "spend" | "leads" | "cpl" | "roas") =>
    typeof deltas?.[key] === "number" && Number.isFinite(deltas[key] as number)
      ? (deltas[key] as number)
      : undefined;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Resumo executivo com dados reais da conta Meta selecionada."
        actions={
          <>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="h-9 w-[160px] gap-1">
                <CalendarDays className="h-3.5 w-3.5" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Exportação em breve")}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Exportação em breve")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Em breve")}>
              <Mail className="h-3.5 w-3.5" /> E-mail
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.info("Em breve")}>
              <Clock className="h-3.5 w-3.5" /> Agendar
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 md:p-8">
        {!useReal && (
          <Card className="flex items-center justify-between border-warning/40 bg-warning-soft/40 p-4 shadow-card">
            <div>
              <p className="text-sm font-semibold">Conta Meta necessária</p>
              <p className="text-xs text-muted-foreground">Relatórios agora usam só dados reais — sem mocks.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/integracoes")}>Ir para Integrações</Button>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Investimento total"
            value={useReal && summary ? formatCompactCurrency(summary.spend) : "—"}
            delta={useReal ? delta("spend") : undefined}
            icon={DollarSign}
          />
          <MetricCard
            label="Leads"
            value={useReal && summary ? formatNumber(summary.leads) : "—"}
            delta={useReal ? delta("leads") : undefined}
            icon={Users2}
            tone="success"
          />
          <MetricCard
            label="CPL médio"
            value={useReal && summary && summary.leads > 0 ? formatCurrency(summary.cpl) : "—"}
            delta={useReal ? delta("cpl") : undefined}
            icon={Target}
            tone="brand"
          />
          <MetricCard
            label="ROAS médio"
            value={useReal && summary && summary.revenue > 0 ? formatRoas(summary.roas) : "—"}
            delta={useReal ? delta("roas") : undefined}
            icon={TrendingUp}
            tone="warning"
          />
        </div>

        <Card className="p-5 shadow-card">
          <h3 className="mb-4 font-display font-bold">Desempenho por plataforma</h3>
          {!useReal ? (
            <EmptyState
              icon={TrendingUp}
              title="Sem dados reais"
              description="Conecte a Meta para ver o desempenho por plataforma."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={byPlatform}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="platform" fontSize={12} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(value, name) => {
                      const n = Number(value);
                      if (String(name) === "Investimento") return [formatCurrency(n), "Investimento"];
                      if (String(name) === "CPL") return [formatCurrency(n), "CPL"];
                      return [formatNumber(n), "Leads"];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="spend" name="Investimento" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="leads" name="Leads" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-display font-bold">Campanhas com melhor CTR</h3>
            {!useReal || topByCtr.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem campanhas com impressões no período.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topByCtr.map((c, i) => (
                  <li key={c.id} className="flex justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2">
                    <span className="truncate"><strong>{i + 1}.</strong> {c.name}</span>
                    <span className="shrink-0 text-muted-foreground">CTR {formatMetaPercent(c.ctr)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-display font-bold">Campanhas com melhor CPL</h3>
            {!useReal || topCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem campanhas com investimento no período.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topCampaigns.map((c, i) => (
                  <li key={c.id} className="flex justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2">
                    <span className="truncate"><strong>{i + 1}.</strong> {c.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      CPL {c.leads > 0 ? formatMetaCurrency(c.cpl) : "—"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
