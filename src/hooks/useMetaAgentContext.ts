// Builds the Meta context payload sent alongside every nanogpt-chat request.
// Never sends tokens. When disconnected/without account, returns a helpful stub so
// the agent can refuse to invent numbers.
import { useMemo } from "react";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaDashboard } from "@/hooks/useMetaData";

export type MetaAgentContext = {
  connected: boolean;
  has_account: boolean;
  organization_id: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  currency: string | null;
  period: { from: string | null; to: string | null } | null;
  summary: Record<string, number | null> | null;
  warnings: string[];
  data_source: "marketing_api" | null;
  guidance: string;
};

export function useMetaAgentContext(period?: { dateFrom?: string; dateTo?: string }): MetaAgentContext {
  const meta = useMetaIntegration();
  const dash = useMetaDashboard(period);

  return useMemo<MetaAgentContext>(() => {
    if (!meta.connected) {
      return {
        connected: false,
        has_account: false,
        organization_id: meta.organizationId,
        ad_account_id: null,
        ad_account_name: null,
        currency: null,
        period: null,
        summary: null,
        warnings: [],
        data_source: null,
        guidance:
          "Conta Meta desconectada. Não invente números — instrua o usuário a conectar em Integrações.",
      };
    }
    if (!meta.selectedAdAccount) {
      return {
        connected: true,
        has_account: false,
        organization_id: meta.organizationId,
        ad_account_id: null,
        ad_account_name: null,
        currency: null,
        period: null,
        summary: null,
        warnings: [],
        data_source: null,
        guidance:
          "Meta conectada, mas nenhuma conta de anúncio foi selecionada. Peça ao usuário para selecionar em Integrações.",
      };
    }
    const s = dash.data?.summary;
    const numericSummary: Record<string, number | null> | null = s
      ? {
          spend: s.spend,
          impressions: s.impressions,
          reach: s.reach,
          clicks: s.clicks,
          unique_clicks: s.unique_clicks,
          link_clicks: s.link_clicks,
          ctr: s.ctr,
          cpc: s.cpc,
          cpm: s.cpm,
          frequency: s.frequency,
          leads: s.leads,
          cpl: s.cpl,
          conversions: s.conversions,
          cost_per_conversion: s.cost_per_conversion,
          results: s.results,
          cpr: s.cpr,
          revenue: s.revenue,
          roas: s.roas,
          active_campaigns: s.active_campaigns,
        }
      : null;
    return {
      connected: true,
      has_account: true,
      organization_id: meta.organizationId,
      ad_account_id: meta.selectedAdAccount.account_id,
      ad_account_name: meta.selectedAdAccount.name,
      currency: meta.selectedAdAccount.currency,
      period: dash.data?.period
        ? { from: dash.data.period.date_from, to: dash.data.period.date_to }
        : null,
      summary: numericSummary,
      warnings: [
        ...(dash.data?.warnings ?? []),
        ...(s?.result_type ? [`result_type=${s.result_type}`] : []),
      ],
      data_source: (dash.data?.data_source as any) ?? "marketing_api",
      guidance: dash.data?.has_activity === false
        ? "Conta conectada, mas sem atividade no período selecionado. Não fabrique métricas."
        : "Use somente os números presentes em summary (inclui CPM, CPR, CPL, CTR, ROAS). Se uma métrica for null, diga que está indisponível.",
    };
  }, [meta.connected, meta.selectedAdAccount, meta.organizationId, dash.data]);
}
