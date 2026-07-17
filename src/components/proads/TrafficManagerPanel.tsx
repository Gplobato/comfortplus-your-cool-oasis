import { useMemo, useState } from "react";
import { ArrowRight, MessageSquare, Sparkles, AlertTriangle, TrendingUp, PauseCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TrafficManagerChat } from "@/components/proads/TrafficManagerChat";
import { useMetaCampaigns } from "@/hooks/useMetaData";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { formatCurrency, formatMetaCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TrafficManagerPanel({
  dateFrom,
  dateTo,
  compareCampaignIds,
  onConsumeCompare,
}: {
  dateFrom: string;
  dateTo: string;
  compareCampaignIds?: string[];
  onConsumeCompare?: () => void;
}) {
  const meta = useMetaIntegration();
  const [open, setOpen] = useState(false);
  const camps = useMetaCampaigns({ dateFrom, dateTo, status: "all" });
  const campaigns = camps.data?.campaigns ?? [];

  const insights = useMemo(() => {
    if (!meta.connected || !campaigns.length) {
      return [
        {
          icon: Sparkles,
          tone: "accent" as const,
          title: "Gerente pronto para analisar",
          body: "Conecte a Meta e selecione uma conta para gerar insights reais de tráfego.",
        },
      ];
    }

    const active = campaigns.filter((c) => c.status === "ACTIVE");
    const pausedWithSpend = campaigns.filter((c) => c.status === "PAUSED" && c.spend > 0);
    const sortedByCpl = [...active].filter((c) => c.leads > 0 && c.cpl != null).sort((a, b) => (a.cpl ?? 0) - (b.cpl ?? 0));
    const burning = [...active].filter((c) => c.spend > 0 && c.leads === 0).sort((a, b) => b.spend - a.spend);
    const topSpend = [...active].sort((a, b) => b.spend - a.spend)[0];

    const items = [];
    if (burning[0]) {
      items.push({
        icon: AlertTriangle,
        tone: "warning" as const,
        title: "Dinheiro sem retorno",
        body: `${burning[0].name} investiu ${formatCurrency(burning[0].spend)} sem leads no período.`,
      });
    }
    if (sortedByCpl[0]) {
      items.push({
        icon: TrendingUp,
        tone: "success" as const,
        title: "Melhor CPL ativo",
        body: `${sortedByCpl[0].name} está em ${formatMetaCurrency(sortedByCpl[0].cpl)} com ${formatNumber(sortedByCpl[0].leads)} leads.`,
      });
    }
    if (pausedWithSpend[0]) {
      items.push({
        icon: PauseCircle,
        tone: "accent" as const,
        title: "Campanha pausada com histórico",
        body: `${pausedWithSpend[0].name} já gerou ${formatCurrency(pausedWithSpend[0].spend)} — vale revisar reativação.`,
      });
    }
    if (topSpend && items.length < 4) {
      items.push({
        icon: Sparkles,
        tone: "brand" as const,
        title: "Maior investimento",
        body: `${topSpend.name} concentra ${formatCurrency(topSpend.spend)} do período.`,
      });
    }
    return items.slice(0, 4);
  }, [campaigns, meta.connected]);

  const toneClass = {
    brand: "bg-blue-soft text-blue-soft-foreground",
    accent: "bg-violet-soft text-violet-soft-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  };

  return (
    <>
      <Card className="overflow-hidden border-border/70 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-violet-soft/40 to-transparent p-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Badge className="border-0 bg-violet-soft text-violet-soft-foreground">
                <Sparkles className="mr-1 h-3 w-3" /> Agente IA
              </Badge>
              <span className="text-[11px] text-muted-foreground">Gerente de Tráfego</span>
            </div>
            <h3 className="font-display text-lg font-bold">Resumo do período</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Insights objetivos sem abrir o chat completo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              Ver análise completa <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="gap-1.5 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => setOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5" /> Conversar com o agente
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClass[insight.tone])}>
                <insight.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-full border-l p-0 sm:max-w-xl lg:max-w-2xl">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-4 w-4 text-accent" /> Gerente de Tráfego
            </SheetTitle>
            <SheetDescription>
              Conversa completa com contexto da conta Meta e campanhas selecionadas.
            </SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100vh-5.5rem)] overflow-hidden p-3">
            <TrafficManagerChat
              className="h-full max-h-none lg:h-full"
              dateFrom={dateFrom}
              dateTo={dateTo}
              compareCampaignIds={compareCampaignIds}
              onConsumeCompare={onConsumeCompare}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
