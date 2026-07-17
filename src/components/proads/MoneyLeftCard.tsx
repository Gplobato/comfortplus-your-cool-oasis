import { AlertTriangle, TrendingDown } from "lucide-react";
import type { MoneyLeftInsight } from "@/lib/trafficChat";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const urgencyStyle = {
  alta: "border-destructive/40 bg-destructive/5",
  media: "border-warning/40 bg-warning-soft/50",
  baixa: "border-border bg-secondary/40",
} as const;

const urgencyLabel = {
  alta: "Urgente",
  media: "Atenção",
  baixa: "Oportunidade",
} as const;

export function MoneyLeftCard({ insight }: { insight: MoneyLeftInsight }) {
  const amount =
    insight.amountBrl != null && Number.isFinite(insight.amountBrl)
      ? formatCurrency(insight.amountBrl)
      : null;

  return (
    <div
      className={cn(
        "mb-3 rounded-xl border px-3 py-2.5",
        urgencyStyle[insight.urgency],
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/80">
          {insight.urgency === "alta" ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dinheiro na mesa · {urgencyLabel[insight.urgency]}
            </span>
          </div>
          {amount ? (
            <p className="mt-0.5 font-display text-lg font-bold leading-tight text-foreground">
              ~{amount}
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                / {insight.period}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 font-display text-sm font-bold text-foreground">
              Há resultado sendo deixado na mesa
            </p>
          )}
          {insight.reason && (
            <p className="mt-1 text-xs leading-relaxed text-foreground/85">{insight.reason}</p>
          )}
          {insight.actionHint && (
            <p className="mt-1.5 text-[11px] font-semibold text-primary">{insight.actionHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
