// Meta campaigns list for the selected ad account (batch insights — no N+1).
// GET ?organization_id=...&status=ACTIVE&date_from=...&date_to=...&limit=200
// Optional: campaign_id=... → single campaign + daily series
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  budgetFromMeta,
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
  normalizeObjective,
  periodLabel,
  safeNum,
  shiftYmd,
  ymdInTz,
} from "../_shared/meta-normalize.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const INSIGHTS_FIELDS =
  "campaign_id,campaign_name,spend,impressions,reach,clicks,unique_clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
}

/** Follow Graph paging until exhausted (cap pages to avoid runaway). */
async function gfetchAll(url: string, maxPages = 10): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = url;
  let pages = 0;
  while (next && pages < maxPages) {
    const j = await gfetch(next);
    out.push(...(j.data ?? []));
    next = j.paging?.next ?? null;
    pages += 1;
  }
  return out;
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

function enrichCampaign(c: any, ins: any | null) {
  const spend = safeNum(ins?.spend);
  const leads = extractLeadCount(ins?.actions);
  const conversions = extractConversionCount(ins?.actions);
  const linkClicks = extractLinkClicks(ins?.actions) || (safeNum(ins?.inline_link_clicks) ?? 0);
  const revenue = extractPurchaseValue(ins?.action_values);
  const objective = normalizeObjective(c.objective);
  const { results, result_type } = extractResults(ins?.actions, objective);
  const roas = extractRoas(ins?.purchase_roas) ??
    (spend !== null && spend > 0 && revenue > 0 ? revenue / spend : null);

  const dailyBudget = budgetFromMeta(c.daily_budget);
  const lifetimeBudget = budgetFromMeta(c.lifetime_budget);
  const budgetRemaining = budgetFromMeta(c.budget_remaining);
  const adsetDaily = typeof c._adset_daily_budget === "number" ? c._adset_daily_budget : null;
  const adsetLifetime = typeof c._adset_lifetime_budget === "number" ? c._adset_lifetime_budget : null;

  let budgetLevel: "campaign" | "adset" | "none" = "none";
  let displayDaily = dailyBudget;
  let displayLifetime = lifetimeBudget;
  if (dailyBudget != null || lifetimeBudget != null) {
    budgetLevel = "campaign";
  } else if (adsetDaily != null || adsetLifetime != null) {
    budgetLevel = "adset";
    displayDaily = adsetDaily;
    displayLifetime = adsetLifetime;
  }

  return {
    id: c.id,
    name: c.name,
    platform: "meta" as const,
    objective,
    status: statusFromEffective(c.effective_status),
    effective_status: c.effective_status,
    budgetLevel,
    dailyBudget: displayDaily ?? 0,
    lifetimeBudget: displayLifetime,
    budgetRemaining,
    startTime: c.start_time ?? null,
    stopTime: c.stop_time ?? null,
    spend: spend ?? 0,
    impressions: safeNum(ins?.impressions) ?? 0,
    reach: safeNum(ins?.reach) ?? 0,
    clicks: safeNum(ins?.clicks) ?? 0,
    unique_clicks: safeNum(ins?.unique_clicks) ?? 0,
    link_clicks: linkClicks,
    ctr: safeNum(ins?.ctr),
    cpc: safeNum(ins?.cpc),
    cpm: safeNum(ins?.cpm),
    frequency: safeNum(ins?.frequency),
    leads,
    conversions,
    revenue,
    results,
    result_type,
    cpl: extractCostPerLead(ins?.cost_per_action_type, spend, leads),
    cpr: extractCostPerResult(ins?.cost_per_action_type, spend, results, result_type),
    roas,
    createdAt: c.created_time,
    updatedAt: c.updated_time,
    createdByAI: false,
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
    logEvent("meta.campaigns.failed", {
      request_id: requestId,
      organization_id: orgId,
      error_code: sel.kind,
    });
    return json({ error: sel.kind, message: (sel as any).message }, 409);
  }

  const tz = sel.account.timezone || "America/Sao_Paulo";
  const today = ymdInTz(new Date(), tz);
  const from = url.searchParams.get("date_from") || shiftYmd(today, -13, tz);
  const to = url.searchParams.get("date_to") || today;
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const objective = (url.searchParams.get("objective") || "").toUpperCase();
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const campaignId = url.searchParams.get("campaign_id") || "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);
  const warnings: string[] = [];
  const timeRange = encodeURIComponent(JSON.stringify({ since: from, until: to }));

  // ---- Single campaign detail mode ----
  if (campaignId) {
    try {
      const [campRes, insRes, seriesRes] = await Promise.all([
        gfetch(
          `${GRAPH}/${campaignId}?fields=id,name,objective,effective_status,status,daily_budget,lifetime_budget,budget_remaining,updated_time,created_time,start_time,stop_time&access_token=${token}`,
        ),
        gfetch(
          `${GRAPH}/${campaignId}/insights?fields=${INSIGHTS_FIELDS.replace("campaign_id,campaign_name,", "")}&time_range=${timeRange}&access_token=${token}`,
        ),
        gfetch(
          `${GRAPH}/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&time_range=${timeRange}&time_increment=1&access_token=${token}`,
        ),
      ]);

      // Adset budgets if campaign-level empty
      let adsetDaily: number | null = null;
      let adsetLifetime: number | null = null;
      if (!campRes.daily_budget && !campRes.lifetime_budget) {
        try {
          const adsets = await gfetchAll(
            `${GRAPH}/${campaignId}/adsets?fields=daily_budget,lifetime_budget,effective_status&limit=100&access_token=${token}`,
          );
          let dSum = 0;
          let lSum = 0;
          let hasD = false;
          let hasL = false;
          for (const a of adsets) {
            const d = budgetFromMeta(a.daily_budget);
            const l = budgetFromMeta(a.lifetime_budget);
            if (d != null) {
              dSum += d;
              hasD = true;
            }
            if (l != null) {
              lSum += l;
              hasL = true;
            }
          }
          adsetDaily = hasD ? dSum : null;
          adsetLifetime = hasL ? lSum : null;
        } catch (e) {
          warnings.push(`adsets: ${sanitizeMetaError(e)}`);
        }
      }
      campRes._adset_daily_budget = adsetDaily;
      campRes._adset_lifetime_budget = adsetLifetime;

      const campaign = enrichCampaign(campRes, (insRes.data ?? [])[0] ?? null);
      const series = (seriesRes.data ?? []).map((row: any) => {
        const spend = safeNum(row.spend);
        const leads = extractLeadCount(row.actions);
        const { results, result_type } = extractResults(row.actions, campaign.objective);
        return {
          date: row.date_start,
          spend: spend ?? 0,
          impressions: safeNum(row.impressions) ?? 0,
          clicks: safeNum(row.clicks) ?? 0,
          cpm: safeNum(row.cpm),
          cpl: extractCostPerLead(row.cost_per_action_type, spend, leads),
          leads,
          results,
          cpr: extractCostPerResult(row.cost_per_action_type, spend, results, result_type),
        };
      });

      return json({
        account: {
          id: sel.account.id,
          name: sel.account.name,
          currency: sel.account.currency,
          timezone: sel.account.timezone,
        },
        period: { date_from: from, date_to: to, label: periodLabel(from, to) },
        campaign,
        series,
        warnings,
        request_id: requestId,
        data_source: "marketing_api",
        synced_at: new Date().toISOString(),
      });
    } catch (e) {
      return json({ error: "campaign_fetch_failed", message: sanitizeMetaError(e) }, 502);
    }
  }

  // ---- List mode ----
  let campaigns: any[] = [];
  try {
    const statusParam =
      status && status !== "ALL"
        ? `&effective_status=${encodeURIComponent(JSON.stringify([status]))}`
        : "";
    campaigns = await gfetchAll(
      `${GRAPH}/${acct}/campaigns?fields=id,name,objective,effective_status,status,daily_budget,lifetime_budget,budget_remaining,updated_time,created_time,start_time,stop_time` +
        `&limit=${Math.min(limit, 100)}${statusParam}&access_token=${token}`,
      8,
    );
    if (objective && objective !== "ALL") {
      campaigns = campaigns.filter((c: any) =>
        String(c.objective ?? "").toUpperCase().includes(objective)
      );
    }
    if (search) {
      campaigns = campaigns.filter((c: any) =>
        String(c.name ?? "").toLowerCase().includes(search)
      );
    }
    campaigns = campaigns.slice(0, limit);
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

  // Batch insights at campaign level (1–few requests instead of N)
  const insightsById = new Map<string, any>();
  try {
    const rows = await gfetchAll(
      `${GRAPH}/${acct}/insights?level=campaign&fields=${INSIGHTS_FIELDS}` +
        `&time_range=${timeRange}&limit=500&access_token=${token}`,
      6,
    );
    for (const row of rows) {
      const id = String(row.campaign_id ?? "");
      if (id) insightsById.set(id, row);
    }
  } catch (e) {
    warnings.push(`insights_batch: ${sanitizeMetaError(e)}`);
  }

  // Batch adset budgets for campaigns missing campaign-level budget (ABO)
  const needsAdsetBudget = campaigns.filter((c) => !c.daily_budget && !c.lifetime_budget);
  if (needsAdsetBudget.length > 0) {
    try {
      const adsets = await gfetchAll(
        `${GRAPH}/${acct}/adsets?fields=campaign_id,daily_budget,lifetime_budget,effective_status` +
          `&limit=200&access_token=${token}`,
        8,
      );
      const dailyByCamp = new Map<string, number>();
      const lifeByCamp = new Map<string, number>();
      for (const a of adsets) {
        const cid = String(a.campaign_id ?? "");
        if (!cid) continue;
        const d = budgetFromMeta(a.daily_budget);
        const l = budgetFromMeta(a.lifetime_budget);
        if (d != null) dailyByCamp.set(cid, (dailyByCamp.get(cid) ?? 0) + d);
        if (l != null) lifeByCamp.set(cid, (lifeByCamp.get(cid) ?? 0) + l);
      }
      for (const c of campaigns) {
        if (c.daily_budget || c.lifetime_budget) continue;
        if (dailyByCamp.has(c.id)) c._adset_daily_budget = dailyByCamp.get(c.id);
        if (lifeByCamp.has(c.id)) c._adset_lifetime_budget = lifeByCamp.get(c.id);
      }
    } catch (e) {
      warnings.push(`adsets_batch: ${sanitizeMetaError(e)}`);
    }
  }

  const enriched = campaigns.map((c) => enrichCampaign(c, insightsById.get(c.id) ?? null));

  // Totals for the filtered set
  const totals = enriched.reduce(
    (acc, c) => {
      acc.spend += c.spend;
      acc.impressions += c.impressions;
      acc.reach += c.reach;
      acc.clicks += c.clicks;
      acc.leads += c.leads;
      acc.conversions += c.conversions;
      acc.results += c.results;
      acc.revenue += c.revenue;
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
      conversions: 0,
      results: 0,
      revenue: 0,
      cpl: null as number | null,
      cpr: null as number | null,
      cpm: null as number | null,
      ctr: null as number | null,
      roas: null as number | null,
    },
  );
  totals.cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
  totals.cpr = totals.results > 0 ? totals.spend / totals.results : null;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null;
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  totals.roas = totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null;

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
    period: { date_from: from, date_to: to, label: periodLabel(from, to) },
    campaigns: enriched,
    totals,
    warnings,
    request_id: requestId,
    data_source: "marketing_api",
    synced_at: new Date().toISOString(),
  });
});
