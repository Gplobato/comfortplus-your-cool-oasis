import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RichChatMessage } from "@/components/proads/RichChatMessage";
import { MoneyLeftCard } from "@/components/proads/MoneyLeftCard";
import { extractMoneyLeft, splitExecutiveBrief, type MoneyLeftInsight } from "@/lib/trafficChat";
import { cn } from "@/lib/utils";

export function CollapsibleChatBody({
  content,
  tone = "assistant",
  moneyLeft: moneyLeftProp,
}: {
  content: string;
  tone?: "assistant" | "user";
  moneyLeft?: MoneyLeftInsight | null;
}) {
  const parsed = extractMoneyLeft(content);
  const insight = moneyLeftProp ?? parsed.insight;
  const body = parsed.cleaned;
  const { brief, detail } = tone === "assistant" ? splitExecutiveBrief(body) : { brief: body, detail: null };
  const [open, setOpen] = useState(false);

  if (tone === "user") {
    return <RichChatMessage content={body} tone="user" />;
  }

  return (
    <div>
      {insight && <MoneyLeftCard insight={insight} />}
      <RichChatMessage content={brief} tone="assistant" />
      {detail && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary",
            )}
          >
            <span>{open ? "Ocultar análise completa" : "Ver análise completa"}</span>
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {open && (
            <div className="mt-2 border-t border-border/60 pt-2">
              <RichChatMessage content={detail} tone="assistant" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
