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
  size?: "md" | "sm";
}

const toneMap = {
  brand: "bg-blue-soft text-blue-soft-foreground",
  accent: "bg-violet-soft text-violet-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "brand",
  hint,
  size = "md",
}: MetricCardProps) {
  const positive = (delta ?? 0) >= 0;
  const compact = size === "sm";
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 bg-card shadow-card transition-shadow hover:shadow-card-md",
        compact ? "p-3.5" : "p-5",
      )}
      title={hint}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>{label}</span>
        <div className={cn("flex shrink-0 items-center justify-center rounded-lg", toneMap[tone], compact ? "h-7 w-7" : "h-9 w-9")}>
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>
      </div>
      <p
        className={cn(
          "mt-2 font-display font-extrabold tracking-tight text-foreground",
          compact ? "text-xl" : "mt-3 text-3xl",
        )}
      >
        {value}
      </p>
      {typeof delta === "number" && Number.isFinite(delta) && (
        <div className={cn("flex items-center gap-1.5", compact ? "mt-1.5 text-[10px]" : "mt-2 text-xs")}>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
              positive ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          {!compact && <span className="text-muted-foreground">{deltaLabel ?? "vs. período anterior"}</span>}
        </div>
      )}
    </Card>
  );
}
