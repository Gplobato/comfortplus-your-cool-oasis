import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { metaKeys } from "@/lib/metaKeys";

async function fetchJson(path: string, params: Record<string, string>) {
  const session = (await supabase.auth.getSession()).data.session;
  const qs = new URLSearchParams(params).toString();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}?${qs}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j?.error ?? `http_${r.status}`;
    throw new Error(String(code));
  }
  return j;
}

export type MetaSummary = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  unique_clicks: number;
  link_clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpp: number | null;
  frequency: number | null;
  leads: number;
  cpl: number | null;
  conversions: number;
  cost_per_conversion: number | null;
  results: number;
  result_type: string;
  cpr: number | null;
  revenue: number;
  roas: number | null;
  active_campaigns: number;
};

export type MetaSeriesPoint = {
  date: string;
  spend: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  link_clicks?: number;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  frequency?: number | null;
  leads: number;
  cpl: number | null;
  results?: number;
  cpr?: number | null;
};

export type MetaDashboard = {
  account: { id: string; external_id: string; name: string; currency: string | null; timezone: string | null };
  period: {
    date_from: string;
    date_to: string;
    label: string;
    previous_from?: string;
    previous_to?: string;
  };
  summary: MetaSummary;
  previous?: MetaSummary;
  deltas?: Partial<Record<keyof MetaSummary, number | null>>;
  series: MetaSeriesPoint[];
  has_activity?: boolean;
  data_source: string;
  synced_at: string;
  warnings: string[];
};

export function useMetaDashboard(opts?: { dateFrom?: string; dateTo?: string; campaignStatus?: string }) {
  const { organizationId, selectedAdAccount, connected } = useMetaIntegration();
  const params: Record<string, string> = { organization_id: organizationId ?? "" };
  if (opts?.dateFrom) params.date_from = opts.dateFrom;
  if (opts?.dateTo) params.date_to = opts.dateTo;
  if (opts?.campaignStatus) params.campaign_status = opts.campaignStatus;

  return useQuery({
    queryKey: metaKeys.dashboard(organizationId, selectedAdAccount?.id ?? null, {
      from: opts?.dateFrom,
      to: opts?.dateTo,
      status: opts?.campaignStatus,
    }),
    queryFn: () => fetchJson("meta-dashboard", params) as Promise<MetaDashboard>,
    enabled: !!organizationId && !!selectedAdAccount && connected,
    staleTime: 90_000,
    placeholderData: (prev) => prev,
  });
}

export type MetaCampaignRow = {
  id: string;
  name: string;
  platform: "meta";
  objective: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT" | "REVIEW";
  effective_status: string;
  budgetLevel?: "campaign" | "adset" | "none";
  dailyBudget: number;
  lifetimeBudget: number | null;
  budgetRemaining: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  unique_clicks?: number;
  link_clicks?: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  leads: number;
  conversions: number;
  revenue: number;
  results?: number;
  result_type?: string;
  cpl: number | null;
  cpr?: number | null;
  roas: number | null;
  startTime: string | null;
  stopTime: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAI: boolean;
};

export type MetaCampaignTotals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  conversions: number;
  results: number;
  revenue: number;
  cpl: number | null;
  cpr: number | null;
  cpm: number | null;
  ctr: number | null;
  roas: number | null;
};

export function useMetaCampaigns(opts?: {
  status?: string;
  objective?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  const { organizationId, selectedAdAccount, connected } = useMetaIntegration();
  const params: Record<string, string> = { organization_id: organizationId ?? "" };
  if (opts?.status && opts.status !== "all") params.status = opts.status;
  if (opts?.objective && opts.objective !== "all") params.objective = opts.objective;
  if (opts?.dateFrom) params.date_from = opts.dateFrom;
  if (opts?.dateTo) params.date_to = opts.dateTo;
  if (opts?.search) params.search = opts.search;

  return useQuery({
    queryKey: metaKeys.campaigns(organizationId, selectedAdAccount?.id ?? null, {
      status: opts?.status,
      objective: opts?.objective,
      from: opts?.dateFrom,
      to: opts?.dateTo,
      search: opts?.search,
    }),
    queryFn: async () => {
      const j = await fetchJson("meta-campaigns", params);
      return j as {
        campaigns: MetaCampaignRow[];
        totals?: MetaCampaignTotals;
        account: any;
        warnings: string[];
        data_source: string;
        synced_at: string;
      };
    },
    enabled: !!organizationId && !!selectedAdAccount && connected,
    staleTime: 90_000,
    placeholderData: (prev) => prev,
  });
}

export function useMetaCampaignDetail(
  campaignId: string | undefined,
  opts?: { dateFrom?: string; dateTo?: string },
) {
  const { organizationId, selectedAdAccount, connected } = useMetaIntegration();
  const params: Record<string, string> = {
    organization_id: organizationId ?? "",
    campaign_id: campaignId ?? "",
  };
  if (opts?.dateFrom) params.date_from = opts.dateFrom;
  if (opts?.dateTo) params.date_to = opts.dateTo;

  return useQuery({
    queryKey: [
      ...metaKeys.campaigns(organizationId, selectedAdAccount?.id ?? null, {
        from: opts?.dateFrom,
        to: opts?.dateTo,
      }),
      "detail",
      campaignId,
    ],
    queryFn: async () => {
      const j = await fetchJson("meta-campaigns", params);
      return j as {
        campaign: MetaCampaignRow;
        series: MetaSeriesPoint[];
        account: any;
        period: { date_from: string; date_to: string; label: string };
        warnings: string[];
      };
    },
    enabled: !!organizationId && !!selectedAdAccount && connected && !!campaignId,
    staleTime: 90_000,
  });
}
