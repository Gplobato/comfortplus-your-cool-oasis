// Shared Meta creatives library builder (used by meta-campaigns?resource=creatives
// and by meta-creatives when that function is deployed).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ActiveSelection } from "./meta-ids.ts";
import { sanitizeMetaError } from "./meta-ids.ts";
import {
  extractConversionCount,
  extractLeadCount,
  extractPurchaseValue,
  extractResults,
  logEvent,
  periodLabel,
  safeNum,
  shiftYmd,
  ymdInTz,
} from "./meta-normalize.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const INSIGHTS_FIELDS =
  "ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
}

async function gfetchAll(url: string, maxPages = 8): Promise<any[]> {
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

function inferType(objectType: string | null | undefined, name: string): string {
  const o = String(objectType ?? "").toUpperCase();
  const n = name.toLowerCase();
  if (o.includes("VIDEO") || n.includes("video") || n.includes("reel")) return "video";
  if (o.includes("CAROUSEL") || n.includes("carousel")) return "carousel";
  if (n.includes("story")) return "story";
  return "image";
}

function emptyPerf() {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    ctr: null as number | null,
    cpc: null as number | null,
    cpm: null as number | null,
    frequency: null as number | null,
    leads: 0,
    cpl: null as number | null,
    conversions: 0,
    results: 0,
    cpr: null as number | null,
    revenue: 0,
    roas: null as number | null,
  };
}

function addInsights(acc: ReturnType<typeof emptyPerf>, row: any) {
  const spend = safeNum(row.spend) ?? 0;
  const impressions = safeNum(row.impressions) ?? 0;
  const reach = safeNum(row.reach) ?? 0;
  const clicks = safeNum(row.clicks) ?? 0;
  const leads = extractLeadCount(row.actions);
  const conversions = extractConversionCount(row.actions);
  const revenue = extractPurchaseValue(row.action_values);
  const { results } = extractResults(row.actions, null);
  acc.spend += spend;
  acc.impressions += impressions;
  acc.reach += reach;
  acc.clicks += clicks;
  acc.leads += leads;
  acc.conversions += conversions;
  acc.results += results;
  acc.revenue += revenue;
}

function finalizePerf(acc: ReturnType<typeof emptyPerf>) {
  acc.ctr = acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : null;
  acc.cpc = acc.clicks > 0 ? acc.spend / acc.clicks : null;
  acc.cpm = acc.impressions > 0 ? (acc.spend / acc.impressions) * 1000 : null;
  acc.frequency = acc.reach > 0 ? acc.impressions / acc.reach : null;
  acc.cpl = acc.leads > 0 ? acc.spend / acc.leads : null;
  acc.cpr = acc.results > 0 ? acc.spend / acc.results : null;
  acc.roas = acc.spend > 0 && acc.revenue > 0 ? acc.revenue / acc.spend : null;
  return acc;
}

function mapDbRow(r: any) {
  return {
    id: r.id,
    db_id: r.id,
    source: r.source,
    meta_creative_id: r.meta_creative_id,
    name: r.name,
    type: r.type ?? "image",
    object_type: r.object_type,
    status: r.status ?? (r.source === "ai" ? "draft" : "used"),
    thumbnail_url: r.thumbnail_url,
    media_url: r.media_url,
    headline: r.headline,
    primary_text: r.primary_text,
    cta: r.cta,
    format: r.format ?? r.type,
    created_by_ai: !!r.created_by_ai || r.source === "ai",
    in_use: !!r.in_use,
    ads_count: r.ads_count ?? 0,
    active_ads_count: r.active_ads_count ?? 0,
    ad_names: r.meta_payload?.ad_names ?? [],
    campaign_ids: r.meta_payload?.campaign_ids ?? [],
    performance: r.performance ?? emptyPerf(),
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_synced_at: r.last_synced_at,
  };
}

export async function buildCreativesPayload(opts: {
  adminClient: SupabaseClient;
  orgId: string;
  sel: ActiveSelection;
  searchParams: URLSearchParams;
  requestId: string;
  started: number;
}) {
  const { adminClient, orgId, sel, searchParams, requestId, started } = opts;

  const tz = sel.account.timezone || "America/Sao_Paulo";
  const today = ymdInTz(new Date(), tz);
  const from = searchParams.get("date_from") || shiftYmd(today, -29, tz);
  const to = searchParams.get("date_to") || today;
  const inUseFilter = (searchParams.get("in_use") || "all").toLowerCase();
  const shouldSync = searchParams.get("sync") === "1" || searchParams.get("sync") === "true";
  const creativeId = searchParams.get("creative_id") || "";

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);
  const timeRange = encodeURIComponent(JSON.stringify({ since: from, until: to }));
  const warnings: string[] = [];

  type Acc = {
    meta_creative_id: string;
    name: string;
    object_type: string | null;
    thumbnail_url: string | null;
    media_url: string | null;
    headline: string | null;
    primary_text: string | null;
    cta: string | null;
    ads: Set<string>;
    activeAds: Set<string>;
    adNames: string[];
    campaignIds: Set<string>;
    perf: ReturnType<typeof emptyPerf>;
    updated_time: string | null;
    created_time: string | null;
  };

  const byCreative = new Map<string, Acc>();

  try {
    const ads = await gfetchAll(
      `${GRAPH}/${acct}/ads?fields=id,name,campaign_id,adset_id,effective_status,status,created_time,updated_time,creative{id,name,thumbnail_url,image_url,object_type,body,title,call_to_action_type,video_id,image_hash}` +
        `&limit=100&access_token=${token}`,
      10,
    );
    for (const ad of ads) {
      const cr = ad.creative;
      if (!cr?.id) continue;
      const id = String(cr.id);
      let row = byCreative.get(id);
      if (!row) {
        row = {
          meta_creative_id: id,
          name: cr.name || ad.name || `Criativo ${id}`,
          object_type: cr.object_type ?? null,
          thumbnail_url: cr.thumbnail_url ?? cr.image_url ?? null,
          media_url: cr.image_url ?? cr.thumbnail_url ?? null,
          headline: cr.title ?? null,
          primary_text: cr.body ?? null,
          cta: cr.call_to_action_type ?? null,
          ads: new Set(),
          activeAds: new Set(),
          adNames: [],
          campaignIds: new Set(),
          perf: emptyPerf(),
          updated_time: ad.updated_time ?? null,
          created_time: ad.created_time ?? null,
        };
        byCreative.set(id, row);
      }
      row.ads.add(String(ad.id));
      if (String(ad.effective_status) === "ACTIVE") row.activeAds.add(String(ad.id));
      if (ad.campaign_id) row.campaignIds.add(String(ad.campaign_id));
      if (ad.name && row.adNames.length < 5) row.adNames.push(ad.name);
      if (ad.updated_time && (!row.updated_time || ad.updated_time > row.updated_time)) {
        row.updated_time = ad.updated_time;
      }
      if (!row.thumbnail_url && (cr.thumbnail_url || cr.image_url)) {
        row.thumbnail_url = cr.thumbnail_url ?? cr.image_url ?? null;
      }
      if (!row.headline && cr.title) row.headline = cr.title;
      if (!row.primary_text && cr.body) row.primary_text = cr.body;
      if (!row.cta && cr.call_to_action_type) row.cta = cr.call_to_action_type;
    }
  } catch (e) {
    warnings.push(`ads: ${sanitizeMetaError(e)}`);
  }

  const insightsByAd = new Map<string, any>();
  try {
    const rows = await gfetchAll(
      `${GRAPH}/${acct}/insights?level=ad&fields=${INSIGHTS_FIELDS}` +
        `&time_range=${timeRange}&limit=500&access_token=${token}`,
      6,
    );
    for (const row of rows) {
      const id = String(row.ad_id ?? "");
      if (id) insightsByAd.set(id, row);
    }
  } catch (e) {
    warnings.push(`insights: ${sanitizeMetaError(e)}`);
  }

  for (const cr of byCreative.values()) {
    for (const adId of cr.ads) {
      const ins = insightsByAd.get(adId);
      if (ins) addInsights(cr.perf, ins);
    }
    finalizePerf(cr.perf);
  }

  let metaCreatives = [...byCreative.values()].map((c) => {
    const in_use = c.activeAds.size > 0;
    const type = inferType(c.object_type, c.name);
    return {
      id: `meta_${c.meta_creative_id}`,
      db_id: null as string | null,
      source: "meta" as const,
      meta_creative_id: c.meta_creative_id,
      name: c.name,
      type,
      object_type: c.object_type,
      status: in_use ? "in_use" : "used",
      thumbnail_url: c.thumbnail_url,
      media_url: c.media_url,
      headline: c.headline,
      primary_text: c.primary_text,
      cta: c.cta,
      format: c.object_type ?? type,
      created_by_ai: false,
      in_use,
      ads_count: c.ads.size,
      active_ads_count: c.activeAds.size,
      ad_names: c.adNames,
      campaign_ids: [...c.campaignIds],
      performance: c.perf,
      created_at: c.created_time,
      updated_at: c.updated_time,
      last_synced_at: new Date().toISOString(),
    };
  });

  if (inUseFilter === "true") metaCreatives = metaCreatives.filter((c) => c.in_use);
  if (inUseFilter === "false") metaCreatives = metaCreatives.filter((c) => !c.in_use);

  if (creativeId) {
    const mid = creativeId.replace(/^meta_/, "");
    metaCreatives = metaCreatives.filter(
      (c) => c.meta_creative_id === mid || c.id === creativeId || c.db_id === creativeId,
    );
  }

  metaCreatives.sort((a, b) => b.performance.spend - a.performance.spend);

  // DB sync is best-effort (table may not exist yet)
  if (shouldSync || metaCreatives.length > 0) {
    try {
      const upserts = metaCreatives.map((c) => ({
        organization_id: orgId,
        source: "meta",
        meta_creative_id: c.meta_creative_id,
        meta_ad_account_id: sel.account.account_id,
        name: c.name,
        type: c.type,
        object_type: c.object_type,
        status: c.status,
        thumbnail_url: c.thumbnail_url,
        media_url: c.media_url,
        headline: c.headline,
        primary_text: c.primary_text,
        cta: c.cta,
        format: c.format,
        created_by_ai: false,
        in_use: c.in_use,
        ads_count: c.ads_count,
        active_ads_count: c.active_ads_count,
        performance: c.performance,
        meta_payload: {
          ad_names: c.ad_names,
          campaign_ids: c.campaign_ids,
        },
        last_synced_at: new Date().toISOString(),
      }));

      for (let i = 0; i < upserts.length; i += 50) {
        const chunk = upserts.slice(i, i + 50);
        const { error } = await adminClient
          .from("creatives")
          .upsert(chunk, { onConflict: "organization_id,meta_creative_id" });
        if (error) warnings.push(`sync: ${error.message}`);
      }

      const { data: dbRows } = await adminClient
        .from("creatives")
        .select("id, meta_creative_id")
        .eq("organization_id", orgId)
        .eq("source", "meta");
      const idMap = new Map((dbRows ?? []).map((r: any) => [String(r.meta_creative_id), String(r.id)]));
      for (const c of metaCreatives) {
        c.db_id = idMap.get(c.meta_creative_id) ?? null;
        if (c.db_id) c.id = c.db_id;
      }
    } catch (e) {
      warnings.push(`sync: ${sanitizeMetaError(e)}`);
    }
  }

  let localCreatives: any[] = [];
  try {
    const { data, error } = await adminClient
      .from("creatives")
      .select("*")
      .eq("organization_id", orgId)
      .in("source", ["ai", "upload"])
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) warnings.push(`local: ${error.message}`);
    else localCreatives = (data ?? []).map(mapDbRow);
  } catch (e) {
    warnings.push(`local: ${sanitizeMetaError(e)}`);
  }

  const creatives = [...localCreatives, ...metaCreatives];

  logEvent("meta.campaigns.loaded", {
    request_id: requestId,
    organization_id: orgId,
    connection_id: sel.connection.id,
    ad_account_id: sel.account.account_id,
    count: creatives.length,
    duration_ms: Date.now() - started,
    warnings: warnings.length,
  });

  return {
    account: {
      id: sel.account.id,
      name: sel.account.name,
      currency: sel.account.currency,
      timezone: sel.account.timezone,
    },
    period: { date_from: from, date_to: to, label: periodLabel(from, to) },
    creatives,
    counts: {
      total: creatives.length,
      meta: metaCreatives.length,
      ai: localCreatives.filter((c) => c.source === "ai").length,
      upload: localCreatives.filter((c) => c.source === "upload").length,
      in_use: creatives.filter((c) => c.in_use).length,
    },
    warnings,
    request_id: requestId,
    data_source: "marketing_api+database",
    synced_at: new Date().toISOString(),
  };
}

export async function buildLocalOnlyCreatives(
  adminClient: SupabaseClient,
  orgId: string,
  kind: string,
  requestId: string,
) {
  const { data: localOnly } = await adminClient
    .from("creatives")
    .select("*")
    .eq("organization_id", orgId)
    .in("source", ["ai", "upload"])
    .order("updated_at", { ascending: false })
    .limit(200);

  return {
    error: kind,
    creatives: (localOnly ?? []).map(mapDbRow),
    warnings: [`meta: ${kind}`],
    request_id: requestId,
    data_source: "database",
  };
}
