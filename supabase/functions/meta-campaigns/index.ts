// Meta campaigns list for the selected ad account (batch insights — no N+1).
// GET ?organization_id=...&status=ACTIVE&date_from=...&date_to=...&limit=200
// Optional: campaign_id=... → single campaign + daily series
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  buildCreativesPayload,
  buildLocalOnlyCreatives,
} from "../_shared/meta-creatives-core.ts";
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

const CHILD_INSIGHTS_FIELDS =
  "spend,impressions,reach,clicks,unique_clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

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

function metricsFromInsights(ins: any | null, objective?: string | null) {
  const spend = safeNum(ins?.spend);
  const leads = extractLeadCount(ins?.actions);
  const conversions = extractConversionCount(ins?.actions);
  const linkClicks = extractLinkClicks(ins?.actions) || (safeNum(ins?.inline_link_clicks) ?? 0);
  const revenue = extractPurchaseValue(ins?.action_values);
  const { results, result_type } = extractResults(ins?.actions, objective);
  const roas = extractRoas(ins?.purchase_roas) ??
    (spend !== null && spend > 0 && revenue > 0 ? revenue / spend : null);
  return {
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
  };
}

function summarizeTargeting(t: any): string {
  if (!t || typeof t !== "object") return "—";
  const parts: string[] = [];
  if (t.age_min != null || t.age_max != null) {
    parts.push(`${t.age_min ?? "?"}-${t.age_max ?? "?"} anos`);
  }
  if (Array.isArray(t.genders) && t.genders.length) {
    const map: Record<number, string> = { 1: "Homens", 2: "Mulheres" };
    parts.push(t.genders.map((g: number) => map[g] ?? String(g)).join("/"));
  }
  const countries = t.geo_locations?.countries;
  if (Array.isArray(countries) && countries.length) parts.push(countries.join(", "));
  const cities = (t.geo_locations?.cities ?? [])
    .map((c: any) => c?.name)
    .filter(Boolean)
    .slice(0, 3);
  if (cities.length) parts.push(cities.join(", "));
  const interests = (t.flexible_spec ?? [])
    .flatMap((s: any) => s?.interests ?? [])
    .map((i: any) => i?.name)
    .filter(Boolean)
    .slice(0, 3);
  if (interests.length) parts.push(interests.join(", "));
  return parts.length ? parts.join(" · ") : "Público amplo / personalizado";
}

function enrichCampaign(c: any, ins: any | null) {
  const objective = normalizeObjective(c.objective);
  const metrics = metricsFromInsights(ins, objective);

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
    ...metrics,
    createdAt: c.created_time,
    updatedAt: c.updated_time,
    createdByAI: false,
  };
}

function enrichAdSet(a: any, ins: any | null, objective: string) {
  const metrics = metricsFromInsights(ins, objective);
  return {
    id: a.id,
    campaign_id: a.campaign_id ?? null,
    name: a.name,
    status: statusFromEffective(a.effective_status),
    effective_status: a.effective_status,
    dailyBudget: budgetFromMeta(a.daily_budget) ?? 0,
    lifetimeBudget: budgetFromMeta(a.lifetime_budget),
    optimization_goal: a.optimization_goal ?? null,
    billing_event: a.billing_event ?? null,
    bid_strategy: a.bid_strategy ?? null,
    targeting_summary: summarizeTargeting(a.targeting),
    startTime: a.start_time ?? null,
    endTime: a.end_time ?? null,
    ...metrics,
    createdAt: a.created_time ?? null,
    updatedAt: a.updated_time ?? null,
  };
}

function enrichAd(ad: any, ins: any | null, objective: string) {
  const metrics = metricsFromInsights(ins, objective);
  const creative = ad.creative ?? {};
  return {
    id: ad.id,
    adset_id: ad.adset_id ?? null,
    campaign_id: ad.campaign_id ?? null,
    name: ad.name,
    status: statusFromEffective(ad.effective_status),
    effective_status: ad.effective_status,
    creative: {
      id: creative.id ?? null,
      name: creative.name ?? null,
      thumbnail_url: creative.thumbnail_url ?? creative.image_url ?? null,
      object_type: creative.object_type ?? null,
      title: creative.title ?? null,
      body: creative.body ?? null,
      cta: creative.call_to_action_type ?? null,
    },
    ...metrics,
    createdAt: ad.created_time ?? null,
    updatedAt: ad.updated_time ?? null,
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

  const resource = (url.searchParams.get("resource") || "").toLowerCase();
  const sel = await loadActiveSelection(ctx.adminClient, orgId);

  // Creatives library via existing function (meta-creatives is not deployed on this project)
  if (resource === "creatives") {
    if ("kind" in sel) {
      const local = await buildLocalOnlyCreatives(ctx.adminClient, orgId, sel.kind, requestId);
      return json(local, 200);
    }
    try {
      const payload = await buildCreativesPayload({
        adminClient: ctx.adminClient,
        orgId,
        sel,
        searchParams: url.searchParams,
        requestId,
        started,
      });
      return json(payload);
    } catch (e) {
      return json({
        error: "creatives_fetch_failed",
        message: sanitizeMetaError(e),
        creatives: [],
        request_id: requestId,
      }, 502);
    }
  }

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

  // ---- Single campaign detail mode (+ adsets + ads hierarchy) ----
  if (campaignId) {
    try {
      const [
        campRes,
        insRes,
        seriesRes,
        adsetsRes,
        adsetInsRes,
        adsRes,
        adInsRes,
      ] = await Promise.allSettled([
        gfetch(
          `${GRAPH}/${campaignId}?fields=id,name,objective,effective_status,status,daily_budget,lifetime_budget,budget_remaining,updated_time,created_time,start_time,stop_time&access_token=${token}`,
        ),
        gfetch(
          `${GRAPH}/${campaignId}/insights?fields=${CHILD_INSIGHTS_FIELDS}&time_range=${timeRange}&access_token=${token}`,
        ),
        gfetch(
          `${GRAPH}/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&time_range=${timeRange}&time_increment=1&access_token=${token}`,
        ),
        gfetchAll(
          `${GRAPH}/${campaignId}/adsets?fields=id,name,campaign_id,effective_status,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,targeting,start_time,end_time,created_time,updated_time&limit=100&access_token=${token}`,
          4,
        ),
        gfetchAll(
          `${GRAPH}/${campaignId}/insights?level=adset&fields=adset_id,adset_name,${CHILD_INSIGHTS_FIELDS}&time_range=${timeRange}&limit=200&access_token=${token}`,
          4,
        ),
        gfetchAll(
          `${GRAPH}/${campaignId}/ads?fields=id,name,adset_id,campaign_id,effective_status,status,created_time,updated_time,creative{id,name,thumbnail_url,image_url,object_type,body,title,call_to_action_type}&limit=100&access_token=${token}`,
          4,
        ),
        gfetchAll(
          `${GRAPH}/${campaignId}/insights?level=ad&fields=ad_id,ad_name,adset_id,${CHILD_INSIGHTS_FIELDS}&time_range=${timeRange}&limit=200&access_token=${token}`,
          4,
        ),
      ]);

      if (campRes.status !== "fulfilled") {
        throw campRes.reason;
      }

      const campObj = campRes.value;
      const objective = normalizeObjective(campObj.objective);

      // ABO budget rollup from adsets list
      let adsetDaily: number | null = null;
      let adsetLifetime: number | null = null;
      const rawAdsets = adsetsRes.status === "fulfilled" ? adsetsRes.value : [];
      if (adsetsRes.status === "rejected") {
        warnings.push(`adsets: ${sanitizeMetaError(adsetsRes.reason)}`);
      }
      if (!campObj.daily_budget && !campObj.lifetime_budget && rawAdsets.length) {
        let dSum = 0;
        let lSum = 0;
        let hasD = false;
        let hasL = false;
        for (const a of rawAdsets) {
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
      }
      campObj._adset_daily_budget = adsetDaily;
      campObj._adset_lifetime_budget = adsetLifetime;

      const campIns = insRes.status === "fulfilled"
        ? (insRes.value.data ?? [])[0] ?? null
        : null;
      if (insRes.status === "rejected") {
        warnings.push(`insights: ${sanitizeMetaError(insRes.reason)}`);
      }

      const campaign = enrichCampaign(campObj, campIns);

      let series: any[] = [];
      if (seriesRes.status === "fulfilled") {
        series = (seriesRes.value.data ?? []).map((row: any) => {
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
      } else {
        warnings.push(`series: ${sanitizeMetaError(seriesRes.reason)}`);
      }

      const adsetInsById = new Map<string, any>();
      if (adsetInsRes.status === "fulfilled") {
        for (const row of adsetInsRes.value) {
          const id = String(row.adset_id ?? "");
          if (id) adsetInsById.set(id, row);
        }
      } else {
        warnings.push(`adset_insights: ${sanitizeMetaError(adsetInsRes.reason)}`);
      }

      const adsets = rawAdsets
        .map((a) => enrichAdSet(a, adsetInsById.get(a.id) ?? null, objective))
        .sort((a, b) => b.spend - a.spend);

      const adInsById = new Map<string, any>();
      if (adInsRes.status === "fulfilled") {
        for (const row of adInsRes.value) {
          const id = String(row.ad_id ?? "");
          if (id) adInsById.set(id, row);
        }
      } else {
        warnings.push(`ad_insights: ${sanitizeMetaError(adInsRes.reason)}`);
      }

      const rawAds = adsRes.status === "fulfilled" ? adsRes.value : [];
      if (adsRes.status === "rejected") {
        warnings.push(`ads: ${sanitizeMetaError(adsRes.reason)}`);
      }

      const ads = rawAds
        .map((ad) => enrichAd(ad, adInsById.get(ad.id) ?? null, objective))
        .sort((a, b) => b.spend - a.spend);

      logEvent("meta.campaigns.loaded", {
        request_id: requestId,
        organization_id: orgId,
        connection_id: sel.connection.id,
        ad_account_id: sel.account.account_id,
        count: 1,
        adsets: adsets.length,
        ads: ads.length,
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
        campaign,
        series,
        adsets,
        ads,
        warnings,
        request_id: requestId,
        data_source: "marketing_api",
        synced_at: new Date().toISOString(),
      });
    } catch (e) {
      return json({ error: "campaign_fetch_failed", message: sanitizeMetaError(e), request_id: requestId }, 502);
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
