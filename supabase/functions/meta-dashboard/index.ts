// Meta ad-account dashboard: KPI summary + daily series + active campaign count.
// GET ?organization_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&campaign_status=ACTIVE
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  extractConversionCount,
  extractCostPerLead,
  extractLeadCount,
  extractPurchaseValue,
  extractRoas,
  logEvent,
  newRequestId,
  safeNum,
} from "../_shared/meta-normalize.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
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

  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 13 * 24 * 3600 * 1000);
  const date_from = url.searchParams.get("date_from") || ymd(defaultFrom);
  const date_to = url.searchParams.get("date_to") || ymd(today);
  const campaignStatusParam = (url.searchParams.get("campaign_status") || "").toUpperCase();

  logEvent("meta.dashboard.requested", {
    request_id: requestId,
    organization_id: orgId,
    connection_id: sel.connection.id,
    ad_account_id: sel.account.account_id,
    date_from,
    date_to,
  });

  const timeRange = encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }));
  const insightsFields =
    "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";
  const warnings: string[] = [];

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);

  // 1. Summary (account level)
  let summary: any = emptySummary();
  let hasActivity = false;
  try {
    const r = await gfetch(
      `${GRAPH}/${acct}/insights?fields=${insightsFields}&time_range=${timeRange}&access_token=${token}`,
    );
    const row = (r.data ?? [])[0];
    if (row) {
      hasActivity = true;
      const spend = safeNum(row.spend);
      const leads = extractLeadCount(row.actions);
      const conversions = extractConversionCount(row.actions);
      const revenue = extractPurchaseValue(row.action_values);
      const roas = extractRoas(row.purchase_roas) ??
        (spend !== null && spend > 0 && revenue > 0 ? revenue / spend : null);
      summary = {
        spend: spend ?? 0,
        impressions: safeNum(row.impressions) ?? 0,
        reach: safeNum(row.reach) ?? 0,
        clicks: safeNum(row.clicks) ?? 0,
        ctr: safeNum(row.ctr),
        cpc: safeNum(row.cpc),
        cpm: safeNum(row.cpm),
        frequency: safeNum(row.frequency),
        leads,
        cpl: extractCostPerLead(row.cost_per_action_type, spend, leads),
        conversions,
        cost_per_conversion:
          conversions > 0 && spend !== null ? spend / conversions : null,
        roas,
        active_campaigns: 0,
      };
    }
  } catch (e) {
    warnings.push(`insights: ${sanitizeMetaError(e)}`);
  }

  // 2. Series (daily)
  let series: any[] = [];
  try {
    const r = await gfetch(
      `${GRAPH}/${acct}/insights?fields=spend,actions,cost_per_action_type&time_range=${timeRange}&time_increment=1&access_token=${token}`,
    );
    series = (r.data ?? []).map((row: any) => {
      const spend = safeNum(row.spend);
      const leads = extractLeadCount(row.actions);
      return {
        date: row.date_start,
        spend: spend ?? 0,
        leads,
        cpl: extractCostPerLead(row.cost_per_action_type, spend, leads),
      };
    });
  } catch (e) {
    warnings.push(`series: ${sanitizeMetaError(e)}`);
  }

  // 3. Active campaigns count
  try {
    const filter =
      campaignStatusParam && campaignStatusParam !== "ALL"
        ? `&effective_status=${encodeURIComponent(JSON.stringify([campaignStatusParam]))}`
        : `&effective_status=${encodeURIComponent(JSON.stringify(["ACTIVE"]))}`;
    const r = await gfetch(
      `${GRAPH}/${acct}/campaigns?fields=id&limit=500${filter}&access_token=${token}`,
    );
    summary.active_campaigns = (r.data ?? []).length;
  } catch (e) {
    warnings.push(`campaigns_count: ${sanitizeMetaError(e)}`);
  }

  await ctx.adminClient
    .from("meta_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", sel.connection.id);

  const daysLabel = (() => {
    const diff =
      Math.round(
        (new Date(date_to).getTime() - new Date(date_from).getTime()) / (24 * 3600 * 1000),
      ) + 1;
    return `Últimos ${diff} dias`;
  })();

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
    period: { date_from, date_to, label: daysLabel },
    summary,
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
    ctr: null,
    cpc: null,
    cpm: null,
    frequency: null,
    leads: 0,
    cpl: null,
    conversions: 0,
    cost_per_conversion: null,
    roas: null,
    active_campaigns: 0,
  };
}
