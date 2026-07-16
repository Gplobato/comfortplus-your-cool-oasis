// Meta ad-account dashboard: KPI summary + daily series + active campaign count.
// GET ?organization_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&campaign_status=ACTIVE
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function num(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function sumActions(actions: any[] | undefined, types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  let s = 0;
  for (const a of actions) {
    if (types.includes(String(a.action_type))) s += Number(a.value) || 0;
  }
  return s;
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

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("organization_id") ?? "";
  if (!orgId) return json({ error: "organization_id_required" }, 400);

  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const sel = await loadActiveSelection(ctx.adminClient, orgId);
  if ("kind" in sel) {
    return json({ error: sel.kind, message: (sel as any).message }, 409);
  }

  // Period
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 13 * 24 * 3600 * 1000);
  const date_from = url.searchParams.get("date_from") || ymd(defaultFrom);
  const date_to = url.searchParams.get("date_to") || ymd(today);
  const campaignStatusParam = (url.searchParams.get("campaign_status") || "").toUpperCase();

  const timeRange = encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }));
  const insightsFields =
    "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values";
  const warnings: string[] = [];

  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);

  // 1. Summary (account level)
  let summary: any = null;
  try {
    const r = await gfetch(
      `${GRAPH}/${acct}/insights?fields=${insightsFields}&time_range=${timeRange}&access_token=${token}`,
    );
    const row = (r.data ?? [])[0];
    if (row) {
      const leads = sumActions(row.actions, ["lead", "onsite_conversion.lead_grouped"]);
      const conversions = sumActions(row.actions, [
        "offsite_conversion.fb_pixel_purchase",
        "purchase",
        "onsite_conversion.purchase",
      ]);
      const revenue = sumActions(row.action_values, [
        "offsite_conversion.fb_pixel_purchase",
        "purchase",
        "onsite_conversion.purchase",
      ]);
      const spend = num(row.spend);
      summary = {
        spend: spend ?? 0,
        impressions: num(row.impressions) ?? 0,
        reach: num(row.reach) ?? 0,
        clicks: num(row.clicks) ?? 0,
        ctr: num(row.ctr),
        cpc: num(row.cpc),
        cpm: num(row.cpm),
        frequency: num(row.frequency),
        leads,
        cpl: leads > 0 && spend != null ? spend / leads : null,
        conversions,
        cost_per_conversion:
          conversions > 0 && spend != null ? spend / conversions : null,
        roas: revenue > 0 && spend && spend > 0 ? revenue / spend : null,
      };
    } else {
      summary = emptySummary();
    }
  } catch (e) {
    warnings.push(`insights: ${sanitizeMetaError(e)}`);
    summary = emptySummary();
  }

  // 2. Series (daily)
  let series: any[] = [];
  try {
    const r = await gfetch(
      `${GRAPH}/${acct}/insights?fields=spend,actions&time_range=${timeRange}&time_increment=1&access_token=${token}`,
    );
    series = (r.data ?? []).map((row: any) => {
      const leads = sumActions(row.actions, ["lead", "onsite_conversion.lead_grouped"]);
      const spend = num(row.spend);
      return {
        date: row.date_start,
        spend: spend ?? 0,
        leads,
        cpl: leads > 0 && spend != null ? spend / leads : null,
      };
    });
  } catch (e) {
    warnings.push(`series: ${sanitizeMetaError(e)}`);
  }

  // 3. Active campaigns count
  let active_campaigns = 0;
  try {
    const filter =
      campaignStatusParam && campaignStatusParam !== "ALL"
        ? `&effective_status=${encodeURIComponent(JSON.stringify([campaignStatusParam]))}`
        : `&effective_status=${encodeURIComponent(JSON.stringify(["ACTIVE"]))}`;
    const r = await gfetch(
      `${GRAPH}/${acct}/campaigns?fields=id&limit=500${filter}&access_token=${token}`,
    );
    active_campaigns = (r.data ?? []).length;
  } catch (e) {
    warnings.push(`campaigns_count: ${sanitizeMetaError(e)}`);
  }
  summary.active_campaigns = active_campaigns;

  // Update last_sync_at best-effort
  await ctx.adminClient
    .from("meta_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", sel.connection.id);

  const daysLabel = (() => {
    const diff = Math.round(
      (new Date(date_to).getTime() - new Date(date_from).getTime()) / (24 * 3600 * 1000),
    ) + 1;
    return `Últimos ${diff} dias`;
  })();

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
    data_source: "marketing_api",
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
