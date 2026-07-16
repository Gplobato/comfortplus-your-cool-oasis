// Meta ad-account dashboard: KPI summary + daily series + active campaign count.
// GET ?organization_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&campaign_status=ACTIVE
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  extractConversionCount,
  extractCostPerLead,
  extractCostPerResult,
  extractLeadCount,
  extractLinkClicks,
  extractPurchaseValue,
  extractResults,
  extractRoas,
  logEvent,
  newRequestId,
  pctChange,
  periodLabel,
  safeNum,
  shiftYmd,
  ymdInTz,
} from "../_shared/meta-normalize.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const INSIGHTS_FIELDS =
  "spend,impressions,reach,clicks,unique_clicks,inline_link_clicks,ctr,cpc,cpm,cpp,frequency,actions,action_values,cost_per_action_type,purchase_roas,video_play_actions,video_thruplay_watched_actions";

async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
}

function summarizeRow(row: any | null | undefined) {
  if (!row) return emptySummary();
  const spend = safeNum(row.spend);
  const leads = extractLeadCount(row.actions);
  const conversions = extractConversionCount(row.actions);
  const linkClicks = extractLinkClicks(row.actions);
  const revenue = extractPurchaseValue(row.action_values);
  const { results, result_type } = extractResults(row.actions, null);
  const roas = extractRoas(row.purchase_roas) ??
    (spend !== null && spend > 0 && revenue > 0 ? revenue / spend : null);
  return {
    spend: spend ?? 0,
    impressions: safeNum(row.impressions) ?? 0,
    reach: safeNum(row.reach) ?? 0,
    clicks: safeNum(row.clicks) ?? 0,
    unique_clicks: safeNum(row.unique_clicks) ?? 0,
    link_clicks: linkClicks || (safeNum(row.inline_link_clicks) ?? 0),
    ctr: safeNum(row.ctr),
    cpc: safeNum(row.cpc),
    cpm: safeNum(row.cpm),
    cpp: safeNum(row.cpp),
    frequency: safeNum(row.frequency),
    leads,
    cpl: extractCostPerLead(row.cost_per_action_type, spend, leads),
    conversions,
    cost_per_conversion:
      conversions > 0 && spend !== null ? spend / conversions : null,
    results,
    result_type,
    cpr: extractCostPerResult(row.cost_per_action_type, spend, results, result_type),
    revenue,
    roas,
    active_campaigns: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const requestId = newRequestId();
  const started = Date.now();

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("organization_id") ?? "";
  if (!orgId) return json({ error: "organization_id_required" }, 400);

  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const sel = await loadActiveSelection(ctx.adminClient, orgId);
  if ("kind" in sel) {
    logEvent("meta.dashboard.failed", {
      request_id: requestId,
      organization_id: orgId,
      error_code: sel.kind,
      duration_ms: Date.now() - started,
    });
    return json({ error: sel.kind, message: (sel as any).message }, 409);
  }

  const tz = sel.account.timezone || "America/Sao_Paulo";
  const today = ymdInTz(new Date(), tz);
  const defaultFrom = shiftYmd(today, -13, tz);
  const date_from = url.searchParams.get("date_from") || defaultFrom;
  const date_to = url.searchParams.get("date_to") || today;
  const campaignStatusParam = (url.searchParams.get("campaign_status") || "").toUpperCase();

  // Previous period of equal length (for deltas)
  const periodDays =
    Math.round(
      (new Date(date_to + "T12:00:00Z").getTime() -
        new Date(date_from + "T12:00:00Z").getTime()) /
        (24 * 3600 * 1000),
    ) + 1;
  const prev_to = shiftYmd(date_from, -1, tz);
  const prev_from = shiftYmd(prev_to, -(periodDays - 1), tz);

  logEvent("meta.dashboard.requested", {
    request_id: requestId,
    organization_id: orgId,
    connection_id: sel.connection.id,
    ad_account_id: sel.account.account_id,
    date_from,
    date_to,
  });

  const timeRange = encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }));
  const prevRange = encodeURIComponent(JSON.stringify({ since: prev_from, until: prev_to }));
  const warnings: string[] = [];

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);

  const statusFilter =
    campaignStatusParam && campaignStatusParam !== "ALL"
      ? campaignStatusParam
      : "ACTIVE";

  const [summaryRes, seriesRes, prevRes, campsRes] = await Promise.allSettled([
    gfetch(
      `${GRAPH}/${acct}/insights?fields=${INSIGHTS_FIELDS}&time_range=${timeRange}&access_token=${token}`,
    ),
    gfetch(
      `${GRAPH}/${acct}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&time_range=${timeRange}&time_increment=1&access_token=${token}`,
    ),
    gfetch(
      `${GRAPH}/${acct}/insights?fields=${INSIGHTS_FIELDS}&time_range=${prevRange}&access_token=${token}`,
    ),
    gfetch(
      `${GRAPH}/${acct}/campaigns?fields=id&limit=500&effective_status=${
        encodeURIComponent(JSON.stringify([statusFilter]))
      }&access_token=${token}`,
    ),
  ]);

  let summary = emptySummary();
  let hasActivity = false;
  if (summaryRes.status === "fulfilled") {
    const row = (summaryRes.value.data ?? [])[0];
    if (row) {
      hasActivity = true;
      summary = summarizeRow(row);
    }
  } else {
    warnings.push(`insights: ${sanitizeMetaError(summaryRes.reason)}`);
  }

  let series: any[] = [];
  if (seriesRes.status === "fulfilled") {
    series = (seriesRes.value.data ?? []).map((row: any) => {
      const spend = safeNum(row.spend);
      const leads = extractLeadCount(row.actions);
      const linkClicks = extractLinkClicks(row.actions);
      const { results, result_type } = extractResults(row.actions, null);
      return {
        date: row.date_start,
        spend: spend ?? 0,
        impressions: safeNum(row.impressions) ?? 0,
        reach: safeNum(row.reach) ?? 0,
        clicks: safeNum(row.clicks) ?? 0,
        link_clicks: linkClicks,
        ctr: safeNum(row.ctr),
        cpc: safeNum(row.cpc),
        cpm: safeNum(row.cpm),
        frequency: safeNum(row.frequency),
        leads,
        cpl: extractCostPerLead(row.cost_per_action_type, spend, leads),
        results,
        cpr: extractCostPerResult(row.cost_per_action_type, spend, results, result_type),
      };
    });
  } else {
    warnings.push(`series: ${sanitizeMetaError(seriesRes.reason)}`);
  }

  let previous = emptySummary();
  if (prevRes.status === "fulfilled") {
    previous = summarizeRow((prevRes.value.data ?? [])[0]);
  } else {
    warnings.push(`previous: ${sanitizeMetaError(prevRes.reason)}`);
  }

  if (campsRes.status === "fulfilled") {
    summary.active_campaigns = (campsRes.value.data ?? []).length;
  } else {
    warnings.push(`campaigns_count: ${sanitizeMetaError(campsRes.reason)}`);
  }

  const deltas = {
    spend: pctChange(summary.spend, previous.spend),
    impressions: pctChange(summary.impressions, previous.impressions),
    clicks: pctChange(summary.clicks, previous.clicks),
    leads: pctChange(summary.leads, previous.leads),
    cpl: summary.cpl != null && previous.cpl != null
      ? pctChange(summary.cpl, previous.cpl)
      : null,
    cpm: summary.cpm != null && previous.cpm != null
      ? pctChange(summary.cpm, previous.cpm)
      : null,
    cpr: summary.cpr != null && previous.cpr != null
      ? pctChange(summary.cpr, previous.cpr)
      : null,
    ctr: summary.ctr != null && previous.ctr != null
      ? pctChange(summary.ctr, previous.ctr)
      : null,
    roas: summary.roas != null && previous.roas != null
      ? pctChange(summary.roas, previous.roas)
      : null,
    conversions: pctChange(summary.conversions, previous.conversions),
    results: pctChange(summary.results, previous.results),
  };

  // Best-effort sync timestamp (don't block response)
  void ctx.adminClient
    .from("meta_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", sel.connection.id);

  logEvent("meta.dashboard.loaded", {
    request_id: requestId,
    organization_id: orgId,
    connection_id: sel.connection.id,
    ad_account_id: sel.account.account_id,
    duration_ms: Date.now() - started,
    has_activity: hasActivity,
    warnings: warnings.length,
  });

  return json({
    account: {
      id: sel.account.id,
      external_id: sel.account.external_id,
      name: sel.account.name,
      currency: sel.account.currency,
      timezone: sel.account.timezone,
    },
    period: {
      date_from,
      date_to,
      label: periodLabel(date_from, date_to),
      previous_from: prev_from,
      previous_to: prev_to,
    },
    summary,
    previous,
    deltas,
    series,
    has_activity: hasActivity,
    data_source: "marketing_api",
    request_id: requestId,
    synced_at: new Date().toISOString(),
    warnings,
  });
});

function emptySummary() {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    unique_clicks: 0,
    link_clicks: 0,
    ctr: null as number | null,
    cpc: null as number | null,
    cpm: null as number | null,
    cpp: null as number | null,
    frequency: null as number | null,
    leads: 0,
    cpl: null as number | null,
    conversions: 0,
    cost_per_conversion: null as number | null,
    results: 0,
    result_type: "unknown",
    cpr: null as number | null,
    revenue: 0,
    roas: null as number | null,
    active_campaigns: 0,
  };
}
