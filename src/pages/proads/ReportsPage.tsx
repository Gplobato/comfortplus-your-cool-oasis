import { useEffect, useState } from "react";
import { CalendarDays, Download, Mail, FileText, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { MetricCard } from "@/components/proads/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyticsService } from "@/services";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/format";
import { DollarSign, Target, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";

export default function ReportsPage() {
  const [data, setData] = useState<{ platform: string; leads: number; spend: number; cpl: number }[]>([]);
  useEffect(() => { analyticsService.byPlatform().then(setData); }, []);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Resumo executivo — desempenho por campanha, plataforma, criativos e públicos."
        actions={
          <>
            <Select defaultValue="30"><SelectTrigger className="h-9 w-[160px] gap-1"><CalendarDays className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.success("PDF gerado")}><FileText className="h-3.5 w-3.5" /> PDF</Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => toast.success("CSV exportado")}><Download className="h-3.5 w-3.5" /> CSV</Button>
            <Button variant="outline" size="sm" className="h-9 gap-2"><Mail className="h-3.5 w-3.5" /> E-mail</Button>
            <Button variant="outline" size="sm" className="h-9 gap-2"><Clock className="h-3.5 w-3.5" /> Agendar</Button>
          </>
        }
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Investimento total" value={formatCompactCurrency(17561)} delta={12.4} icon={DollarSign} />
          <MetricCard label="Leads" value={formatNumber(1250)} delta={18.7} icon={Users2} tone="accent" />
          <MetricCard label="CPL médio" value={formatCurrency(14.05)} delta={-6.2} icon={Target} tone="success" />
          <MetricCard label="ROAS médio" value="4.32x" delta={5.1} icon={TrendingUp} tone="warning" />
        </div>

        <Card className="p-5 shadow-card">
          <h3 className="mb-4 font-display font-bold">Desempenho por plataforma</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="platform" fontSize={12} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="spend" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-display font-bold">Criativos vencedores</h3>
            <ol className="space-y-2 text-sm">
              {["Engenheiro com celular", "Timelapse 60 dias", "Dashboard indicadores"].map((n, i) => (
                <li key={n} className="flex justify-between rounded-md bg-secondary/40 px-3 py-2">
                  <span><strong>{i + 1}.</strong> {n}</span>
                  <span className="text-muted-foreground">CTR {(4 - i * 0.5).toFixed(1)}%</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-display font-bold">Públicos vencedores</h3>
            <ol className="space-y-2 text-sm">
              {["Visitantes 30d", "Lookalike 2%", "Interesse construção SP"].map((n, i) => (
                <li key={n} className="flex justify-between rounded-md bg-secondary/40 px-3 py-2">
                  <span><strong>{i + 1}.</strong> {n}</span>
                  <span className="text-muted-foreground">CPL R$ {(7 + i * 1.5).toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
