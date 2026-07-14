import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users2,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Megaphone,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Check,
  X,
  MessageSquare,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/proads/PageHeader";
import { MetricCard } from "@/components/proads/MetricCard";
import { CampaignStatusBadge, PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { analyticsService, campaignService } from "@/services";
import { approvals, creatives, recommendations } from "@/mocks/data";
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Campaign, MetricPoint } from "@/types/proads";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { EmptyState } from "@/components/proads/EmptyState";
import { toast } from "sonner";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { demoMode } = useDemoMode();
  const [series, setSeries] = useState<MetricPoint[]>([]);
  const [campaignList, setCampaignList] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!demoMode) {
      setSeries([]);
      setCampaignList([]);
      return;
    }
    analyticsService.overview().then(setSeries);
    campaignService.list().then(setCampaignList);
  }, [demoMode]);

  const displayApprovals = demoMode ? approvals : [];
  const displayCreatives = demoMode ? creatives : [];
  const displayRecommendations = demoMode ? recommendations : [];
  const activeCampaigns = campaignList.filter((c) => c.status === "ACTIVE");

  return (
    <>
      <PageHeader
        title="Visão Geral"
        description="Acompanhe campanhas, criativos e recomendações da inteligência artificial."
        actions={
          <>
            <Select defaultValue="14d">
              <SelectTrigger className="h-9 w-[150px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="14d">Últimos 14 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="h-9 w-[150px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as plataformas</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => {
                analyticsService.overview().then(setSeries);
                toast.success("Dados atualizados");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {demoMode ? (
            <>
              <MetricCard label="Leads" value={formatNumber(1250)} delta={18.7} icon={Users2} tone="brand" />
              <MetricCard label="CPL" value="R$ 12,45" delta={-8.3} icon={Target} tone="accent" />
              <MetricCard label="Investimento" value={formatCompactCurrency(15562.34)} delta={14.2} icon={DollarSign} tone="brand" />
              <MetricCard label="ROAS" value="4,32x" delta={22.1} icon={TrendingUp} tone="success" />
              <MetricCard label="Conversões" value={formatNumber(384)} delta={12.4} icon={MousePointerClick} tone="accent" />
              <MetricCard label="Campanhas ativas" value="12" delta={2.0} icon={Megaphone} tone="warning" />
            </>
          ) : (
            <>
              <MetricCard label="Leads" value="0" icon={Users2} tone="brand" />
              <MetricCard label="CPL" value="—" icon={Target} tone="accent" />
              <MetricCard label="Investimento" value="R$ 0,00" icon={DollarSign} tone="brand" />
              <MetricCard label="ROAS" value="—" icon={TrendingUp} tone="success" />
              <MetricCard label="Conversões" value="0" icon={MousePointerClick} tone="accent" />
              <MetricCard label="Campanhas ativas" value="0" icon={Megaphone} tone="warning" />
            </>
          )}
        </div>

        {/* Chart + AI Assistant */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold">Desempenho</h3>
                <p className="text-xs text-muted-foreground">Leads e CPL nos últimos 14 dias</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Leads</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> CPL (R$)</span>
              </div>
            </div>
            <div className="h-72 w-full">
              {demoMode ? (
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ display: "none" }} />
                    <Line yAxisId="left" type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={BarChart3}
                    title="Sem dados de desempenho"
                    description="Conecte uma plataforma de anúncios ou ative o modo demo para visualizar métricas."
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="flex flex-col shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold">Assistente ProAds</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "bg-success" : "bg-muted-foreground"}`} />
                    {demoMode ? "Online" : "Aguardando dados"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3 p-4">
              {demoMode ? (
                <>
                  <div className="rounded-lg bg-secondary/60 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Você</p>
                    <p className="mt-1 text-sm">Analise minhas campanhas e encontre oportunidades de melhoria.</p>
                  </div>
                  <div className="rounded-lg bg-gradient-brand-soft p-3">
                    <p className="text-xs font-semibold text-primary">Diretor de Marketing</p>
                    <p className="mt-1 text-sm">
                      Identifiquei <strong>3 campanhas</strong> com CPL acima da meta e <strong>2 oportunidades</strong> de aumento de orçamento.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                  Nenhuma conversa iniciada. Abra o chat para começar.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-3">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/agente")}>Ver análise</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/aprovacoes")}>Aplicar sugestões</Button>
              <Button size="sm" className="ml-auto gap-1.5 bg-gradient-brand text-xs text-primary-foreground" onClick={() => navigate("/agente")}>
                <MessageSquare className="h-3 w-3" /> Abrir chat
              </Button>
            </div>
          </Card>
        </div>

        {/* Approvals + Creatives */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-display font-bold">Aprovações pendentes</h3>
                <p className="text-xs text-muted-foreground">{displayApprovals.length} itens aguardando decisão</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/aprovacoes")}>
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {displayApprovals.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma aprovação pendente.
                </div>
              ) : (
                displayApprovals.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand-soft">
                      <Sparkles className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.requestedBy} · {formatDate(a.createdAt)} ·{" "}
                        <span className="font-medium text-foreground">
                          confiança {Math.round(a.confidence * 100)}%
                        </span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        a.urgency === "high"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : a.urgency === "medium"
                          ? "border-warning/30 bg-warning-soft text-warning"
                          : "border-border bg-muted"
                      }
                    >
                      {a.urgency === "high" ? "Alta" : a.urgency === "medium" ? "Média" : "Baixa"}
                    </Badge>
                    <div className="hidden gap-1 md:flex">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => toast.error("Rejeitado")}>
                        <X className="h-3.5 w-3.5" /> Rejeitar
                      </Button>
                      <Button size="sm" className="h-8 gap-1 bg-gradient-brand text-primary-foreground" onClick={() => toast.success("Aprovado")}>
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* AI Recommendations */}
          <Card className="shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="font-display font-bold">Sugestões da IA</h3>
              </div>
            </div>
            <div className="divide-y divide-border">
              {displayRecommendations.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Sem sugestões no momento.
                </div>
              ) : (
                displayRecommendations.map((r) => (
                  <div key={r.id} className="p-4">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.explanation}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className="bg-success-soft text-success">{r.impact}</Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.success("Sugestão aplicada")}>
                        Aplicar sugestão
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Creatives + Campaigns */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-card lg:col-span-1">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-display font-bold">Criativos recentes</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/criativos")}>Ver todos</Button>
            </div>
            {displayCreatives.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum criativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4">
                {displayCreatives.slice(0, 4).map((c) => (
                  <div key={c.id} className="group cursor-pointer" onClick={() => navigate(`/criativos/${c.id}`)}>
                    <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                      <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <p className="mt-1.5 truncate text-xs font-semibold">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.format}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="shadow-card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-display font-bold">Campanhas ativas</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/campanhas")}>
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              {activeCampaigns.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma campanha ativa.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Campanha</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Leads</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">CPL</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Investimento</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCampaigns.slice(0, 5).map((c) => (
                      <TableRow key={c.id} className="cursor-pointer border-border" onClick={() => navigate(`/campanhas/${c.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlatformBadge platform={c.platform} showLabel={false} />
                            <span className="text-sm font-medium">{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatNumber(c.leads)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.cpl)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.spend)}</TableCell>
                        <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Visualizar</DropdownMenuItem>
                              <DropdownMenuItem>Editar</DropdownMenuItem>
                              <DropdownMenuItem>Duplicar</DropdownMenuItem>
                              <DropdownMenuItem>Pausar</DropdownMenuItem>
                              <DropdownMenuItem>Arquivar</DropdownMenuItem>
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
      </div>
    </>
  );
}
