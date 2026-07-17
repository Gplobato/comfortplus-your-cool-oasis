import { CampaignStatusBadge } from "@/components/proads/Badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatCurrency, formatFreq, formatMetaCurrency, formatMetaNumber,
  formatMetaPercent, formatRoas,
} from "@/lib/format";
import type { CampaignStatus } from "@/types/proads";
import type { ReactNode } from "react";

export type HierarchyMetricRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  leads: number;
  cpl: number | null;
  results: number;
  cpr: number | null;
  roas: number | null;
  dailyBudget?: number;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
};

export function HierarchyMetricsTable({
  rows,
  emptyLabel = "Nenhum item neste período.",
  showBudget = false,
}: {
  rows: HierarchyMetricRow[];
  emptyLabel?: string;
  showBudget?: boolean;
}) {
  if (!rows.length) {
    return <div className="p-8 text-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Nome</TableHead>
            {showBudget && <TableHead className="text-right text-xs uppercase tracking-wider">Orç. diário</TableHead>}
            <TableHead className="text-right text-xs uppercase tracking-wider">Invest.</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">Impr.</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">Cliques</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">CTR</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">CPM</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">CPC</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">Freq.</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">Leads</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">CPL</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">Result.</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">CPR</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider">ROAS</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
            {rows.some((row) => row.actions) && <TableHead className="text-right text-xs uppercase tracking-wider">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="border-border">
              <TableCell>
                <div className="flex min-w-[200px] items-start gap-2">
                  {r.leading}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    {r.subtitle && (
                      <p className="truncate text-[10px] text-muted-foreground">{r.subtitle}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              {showBudget && (
                <TableCell className="text-right text-sm">
                  {r.dailyBudget ? formatCurrency(r.dailyBudget) : "—"}
                </TableCell>
              )}
              <TableCell className="text-right text-sm font-semibold">{formatCurrency(r.spend)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaNumber(r.impressions)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaNumber(r.clicks)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaPercent(r.ctr)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaCurrency(r.cpm)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaCurrency(r.cpc)}</TableCell>
              <TableCell className="text-right text-sm">{formatFreq(r.frequency)}</TableCell>
              <TableCell className="text-right text-sm font-semibold">{formatMetaNumber(r.leads)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaCurrency(r.cpl)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaNumber(r.results)}</TableCell>
              <TableCell className="text-right text-sm">{formatMetaCurrency(r.cpr)}</TableCell>
              <TableCell className="text-right text-sm">{formatRoas(r.roas)}</TableCell>
              <TableCell><CampaignStatusBadge status={r.status} /></TableCell>
              {rows.some((row) => row.actions) && <TableCell className="text-right">{r.actions}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
