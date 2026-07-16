// Meta campaigns list for the selected ad account.
// GET ?organization_id=...&status=ACTIVE&date_from=...&date_to=...&limit=100
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

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
}

function statusFromEffective(s: string): "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT" | "REVIEW" {
  switch (s) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "ARCHIVED":
    case "DELETED":
      return "ARCHIVED";
    case "IN_PROCESS":
    case "WITH_ISSUES":
    case "PENDING_REVIEW":
      return "REVIEW";
    default:
      return "PAUSED";
  }
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
    logEvent("meta.campaigns.failed", {
      request_id: requestId,
      organization_id: orgId,
      error_code: sel.kind,
    });
    return json({ error: sel.kind, message: (sel as any).message }, 409);
  }

  const today = new Date();
  const from = url.searchParams.get("date_from") || ymd(new Date(today.getTime() - 13 * 864e5));
  const to = url.searchParams.get("date_to") || ymd(today);
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);
  const warnings: string[] = [];

  let campaigns: any[] = [];
  try {
    const effective =
      status && status !== "ALL"
        ? `&effective_status=${encodeURIComponent(JSON.stringify([status]))}`
        : "";
    const r = await gfetch(
      `${GRAPH}/${acct}/campaigns?fields=id,name,objective,effective_status,status,daily_budget,lifetime_budget,updated_time,created_time,start_time,stop_time` +
        `&limit=${limit}${effective}&access_token=${token}`,
    );
    campaigns = r.data ?? [];
  } catch (e) {
    warnings.push(`campaigns: ${sanitizeMetaError(e)}`);
    logEvent("meta.campaigns.failed", {
      request_id: requestId,
      organization_id: orgId,
      ad_account_id: sel.account.account_id,
      error_code: sanitizeMetaError(e),
      duration_ms: Date.now() - started,
    });
    return json({
      account: { id: sel.account.id, name: sel.account.name, currency: sel.account.currency },
      campaigns: [],
      warnings,
      data_source: "marketing_api",
    });
  }

  const timeRange = encodeURIComponent(JSON.stringify({ since: from, until: to }));
  const insightsFields =
    "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";
  const enriched: any[] = [];
  for (const c of campaigns) {
    let ins: any = null;
    try {
      const r = await gfetch(
        `${GRAPH}/${c.id}/insights?fields=${insightsFields}&time_range=${timeRange}&access_token=${token}`,
      );
      ins = (r.data ?? [])[0] ?? null;
    } catch (e) {
      warnings.push(`insights_${c.id}: ${sanitizeMetaError(e)}`);
    }
    const spend = safeNum(ins?.spend);
    const leads = extractLeadCount(ins?.actions);
    const conversions = extractConversionCount(ins?.actions);
    const revenue = extractPurchaseValue(ins?.action_values);
    const roas = extractRoas(ins?.purchase_roas) ??
      (spend !== null && spend > 0 && revenue > 0 ? revenue / spend : null);
    enriched.push({
      id: c.id,
      name: c.name,
      platform: "meta",
      objective: (c.objective ?? "").toLowerCase().replace(/^outcome_/, ""),
      status: statusFromEffective(c.effective_status),
      effective_status: c.effective_status,
      dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
      lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      startTime: c.start_time ?? null,
      stopTime: c.stop_time ?? null,
      spend: spend ?? 0,
      impressions: safeNum(ins?.impressions) ?? 0,
      reach: safeNum(ins?.reach) ?? 0,
      clicks: safeNum(ins?.clicks) ?? 0,
      ctr: safeNum(ins?.ctr),
      cpc: safeNum(ins?.cpc),
      cpm: safeNum(ins?.cpm),
      frequency: safeNum(ins?.frequency),
      leads,
      conversions,
      cpl: extractCostPerLead(ins?.cost_per_action_type, spend, leads),
      roas,
      createdAt: c.created_time,
      updatedAt: c.updated_time,
      createdByAI: false,
    });
  }

  logEvent("meta.campaigns.loaded", {
    request_id: requestId,
    organization_id: orgId,
    connection_id: sel.connection.id,
    ad_account_id: sel.account.account_id,
    count: enriched.length,
    duration_ms: Date.now() - started,
    warnings: warnings.length,
  });

  return json({
    account: {
      id: sel.account.id,
      name: sel.account.name,
      currency: sel.account.currency,
      timezone: sel.account.timezone,
    },
    period: { date_from: from, date_to: to },
    campaigns: enriched,
    warnings,
    request_id: requestId,
    data_source: "marketing_api",
    synced_at: new Date().toISOString(),
  });
});
