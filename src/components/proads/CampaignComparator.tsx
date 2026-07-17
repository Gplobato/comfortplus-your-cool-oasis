import { useMemo, useState } from "react";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMetaCampaigns, type MetaCampaignRow } from "@/hooks/useMetaData";
import {
  formatCurrency, formatMetaCurrency, formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { EmptyState } from "@/components/proads/EmptyState";
import { cn } from "@/lib/utils";

const METRICS: { key: keyof MetaCampaignRow; label: string; fmt: (c: MetaCampaignRow) => string }[] = [
  { key: "spend", label: "Investimento", fmt: (c) => formatCurrency(c.spend) },
  { key: "impressions", label: "Impressões", fmt: (c) => formatNumber(c.impressions) },
  { key: "clicks", label: "Cliques", fmt: (c) => formatNumber(c.clicks) },
  { key: "ctr", label: "CTR", fmt: (c) => formatMetaPercent(c.ctr) },
  { key: "cpm", label: "CPM", fmt: (c) => formatMetaCurrency(c.cpm) },
  { key: "leads", label: "Leads", fmt: (c) => formatNumber(c.leads) },
  { key: "cpl", label: "CPL", fmt: (c) => formatMetaCurrency(c.cpl) },
  { key: "cpr", label: "CPR", fmt: (c) => formatMetaCurrency(c.cpr ?? null) },
  { key: "roas", label: "ROAS", fmt: (c) => formatRoas(c.roas) },
  { key: "dailyBudget", label: "Budget/dia", fmt: (c) => formatCurrency(c.dailyBudget) },
  { key: "status", label: "Status", fmt: (c) => c.status },
];

function bestId(rows: MetaCampaignRow[], key: keyof MetaCampaignRow, lowerIsBetter: boolean) {
  const scored = rows
    .map((r) => ({ id: r.id, v: Number(r[key]) }))
    .filter((x) => Number.isFinite(x.v) && x.v > 0);
  if (!scored.length) return null;
  scored.sort((a, b) => (lowerIsBetter ? a.v - b.v : b.v - a.v));
  return scored[0].id;
}

export function CampaignComparator({
  dateFrom,
  dateTo,
  onAskManager,
}: {
  dateFrom: string;
  dateTo: string;
  onAskManager?: (campaignIds: string[], campaigns: MetaCampaignRow[]) => void;
}) {
  const camps = useMetaCampaigns({ dateFrom, dateTo });
  const list = camps.data?.campaigns ?? [];
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = useMemo(
    () => list.filter((c) => selected.includes(c.id)).slice(0, 4),
    [list, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const winners = useMemo(() => {
    if (chosen.length < 2) return {} as Record<string, string | null>;
    return {
      spend: bestId(chosen, "spend", true),
      cpl: bestId(chosen, "cpl", true),
      cpm: bestId(chosen, "cpm", true),
      ctr: bestId(chosen, "ctr", false),
      leads: bestId(chosen, "leads", false),
      roas: bestId(chosen, "roas", false),
    };
  }, [chosen]);

  return (
    <Card className="shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand-soft">
            <GitCompareArrows className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">Comparador de campanhas</h3>
            <p className="text-[11px] text-muted-foreground">
              Selecione até 4 campanhas · destaque = melhor na métrica
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-gradient-brand text-primary-foreground"
          disabled={chosen.length < 2}
          onClick={() => onAskManager?.(chosen.map((c) => c.id), chosen)}
        >
          Pedir análise ao Gerente
        </Button>
      </div>

      {!camps.isFetched && camps.isLoading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando campanhas…
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="Sem campanhas para comparar"
          description="Conecte a Meta e aguarde o sync de campanhas."
        />
      ) : (
        <div className="grid gap-0 lg:grid-cols-[240px_1fr]">
          <div className="max-h-80 space-y-1 overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
            {list.slice(0, 40).map((c) => {
              const on = selected.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary/60",
                    on && "bg-gradient-brand-soft",
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-medium">{c.name}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {formatCurrency(c.spend)} · CPL {formatMetaCurrency(c.cpl)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="overflow-x-auto p-3">
            {chosen.length < 2 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Escolha pelo menos 2 campanhas para ver a tabela comparativa.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs">Métrica</TableHead>
                    {chosen.map((c) => (
                      <TableHead key={c.id} className="min-w-[140px] text-xs">
                        <div className="line-clamp-2 font-semibold text-foreground">{c.name}</div>
                        <Badge variant="outline" className="mt-1 text-[9px]">{c.status}</Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {METRICS.map((m) => (
                    <TableRow key={String(m.key)} className="border-border">
                      <TableCell className="text-xs text-muted-foreground">{m.label}</TableCell>
                      {chosen.map((c) => {
                        const win = winners[String(m.key)] === c.id;
                        return (
                          <TableCell
                            key={c.id}
                            className={cn("text-sm font-medium", win && "bg-success-soft/40 text-success")}
                          >
                            {m.fmt(c)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
