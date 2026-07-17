import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  tone?: "brand" | "accent" | "success" | "warning";
  hint?: string;
}

const toneMap = {
  brand: "bg-blue-soft text-blue-soft-foreground",
  accent: "bg-violet-soft text-violet-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function MetricCard({ label, value, delta, deltaLabel, icon: Icon, tone = "brand", hint }: MetricCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card
      className="group relative overflow-hidden border-border/70 bg-card p-5 shadow-card transition-shadow hover:shadow-card-md"
      title={hint}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
      {typeof delta === "number" && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
              positive ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{deltaLabel ?? "vs. período anterior"}</span>
        </div>
      )}
    </Card>
  );
}
