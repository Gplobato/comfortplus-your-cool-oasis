import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { metaKeys } from "@/lib/metaKeys";
import { listOwnedCreatives, type OwnedCreative } from "@/lib/creative-library";

export class MetaApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(input: { code: string; message?: string; status: number; requestId?: string }) {
    super(input.message || input.code);
    this.name = "MetaApiError";
    this.code = input.code;
    this.status = input.status;
    this.requestId = input.requestId;
  }
}

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
    throw new MetaApiError({
      code: String(j?.error ?? `http_${r.status}`),
      message: j?.message ? String(j.message) : undefined,
      status: r.status,
      requestId: j?.request_id ? String(j.request_id) : undefined,
    });
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
  metric_availability?: {
    cpl: boolean;
    cpr: boolean;
    roas: boolean;
    result: boolean;
  };
};

function finiteOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMetaSummary(value: Partial<MetaSummary> | null | undefined): MetaSummary {
  const s = value ?? {};
  return {
    spend: finiteOrZero(s.spend),
    impressions: finiteOrZero(s.impressions),
    reach: finiteOrZero(s.reach),
    clicks: finiteOrZero(s.clicks),
    unique_clicks: finiteOrZero(s.unique_clicks),
    link_clicks: finiteOrZero(s.link_clicks),
    ctr: finiteOrNull(s.ctr),
    cpc: finiteOrNull(s.cpc),
    cpm: finiteOrNull(s.cpm),
    cpp: finiteOrNull(s.cpp),
    frequency: finiteOrNull(s.frequency),
    leads: finiteOrZero(s.leads),
    cpl: finiteOrNull(s.cpl),
    conversions: finiteOrZero(s.conversions),
    cost_per_conversion: finiteOrNull(s.cost_per_conversion),
    results: finiteOrZero(s.results),
    result_type: String(s.result_type || "unknown"),
    cpr: finiteOrNull(s.cpr),
    revenue: finiteOrZero(s.revenue),
    roas: finiteOrNull(s.roas),
    active_campaigns: finiteOrZero(s.active_campaigns),
    metric_availability: s.metric_availability,
  };
}

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
    queryFn: async () => {
      const raw = (await fetchJson("meta-dashboard", params)) as MetaDashboard;
      return {
        ...raw,
        summary: normalizeMetaSummary(raw.summary),
        previous: raw.previous ? normalizeMetaSummary(raw.previous) : undefined,
      };
    },
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
  metric_availability?: MetaSummary["metric_availability"];
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
  });
}

export type MetaAdSetRow = {
  id: string;
  campaign_id: string | null;
  name: string;
  status: MetaCampaignRow["status"];
  effective_status: string;
  dailyBudget: number;
  lifetimeBudget: number | null;
  optimization_goal: string | null;
  billing_event: string | null;
  bid_strategy: string | null;
  targeting_summary: string;
  startTime: string | null;
  endTime: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  leads: number;
  conversions: number;
  revenue: number;
  results: number;
  result_type: string;
  cpl: number | null;
  cpr: number | null;
  roas: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MetaAdRow = {
  id: string;
  adset_id: string | null;
  campaign_id: string | null;
  name: string;
  status: MetaCampaignRow["status"];
  effective_status: string;
  creative: {
    id: string | null;
    name: string | null;
    thumbnail_url: string | null;
    object_type: string | null;
    title: string | null;
    body: string | null;
    cta: string | null;
  };
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  leads: number;
  conversions: number;
  revenue: number;
  results: number;
  result_type: string;
  cpl: number | null;
  cpr: number | null;
  roas: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

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
    queryKey: metaKeys.campaignDetail(
      organizationId,
      selectedAdAccount?.id ?? null,
      campaignId ?? null,
      { from: opts?.dateFrom, to: opts?.dateTo },
    ),
    queryFn: async () => {
      const j = await fetchJson("meta-campaigns", params);
      return j as {
        campaign: MetaCampaignRow;
        series: MetaSeriesPoint[];
        adsets: MetaAdSetRow[];
        ads: MetaAdRow[];
        account: any;
        period: { date_from: string; date_to: string; label: string };
        warnings: string[];
        request_id?: string;
      };
    },
    enabled: !!organizationId && !!selectedAdAccount && connected && !!campaignId,
    staleTime: 90_000,
  });
}

export type LibraryCreative = OwnedCreative;

export function useMetaCreatives(opts?: {
  includeArchived?: boolean;
}) {
  const { organizationId } = useMetaIntegration();

  return useQuery({
    queryKey: ["creative-library", organizationId, !!opts?.includeArchived],
    queryFn: async ({ signal }) => {
      const creatives = await listOwnedCreatives(
        organizationId!,
        !!opts?.includeArchived,
        signal,
      );
      return {
        creatives,
        counts: {
          total: creatives.length,
          ai: creatives.filter((c) => c.source === "ai").length,
          upload: creatives.filter((c) => c.source === "upload").length,
          ready: creatives.filter((c) => c.publication_status === "ready").length,
        },
        warnings: [] as string[],
        data_source: "owned_library",
      };
    },
    enabled: !!organizationId,
    staleTime: 90_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Persist an AI-generated creative into the shared library (alongside Meta). */
export async function saveAiCreative(input: {
  organizationId: string;
  name: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  type?: string;
  headline?: string | null;
  primaryText?: string | null;
  cta?: string | null;
  userId?: string | null;
}) {
  const { data, error } = await supabase
    .from("creatives" as any)
    .insert({
      organization_id: input.organizationId,
      source: "ai",
      name: input.name,
      type: input.type ?? "image",
      format: input.type ?? "image",
      thumbnail_url: input.thumbnailUrl ?? input.mediaUrl ?? null,
      media_url: input.mediaUrl ?? input.thumbnailUrl ?? null,
      headline: input.headline ?? null,
      primary_text: input.primaryText ?? null,
      cta: input.cta ?? null,
      created_by_ai: true,
      created_by_user_id: input.userId ?? null,
      status: "draft",
      in_use: false,
      performance: {},
      meta_payload: {},
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
