// Meta ad-account geographic breakdown: impressions + leads + spend by country/region.
// GET ?organization_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&breakdown=country|region
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  extractLeadCount,
  logEvent,
  newRequestId,
  safeNum,
  shiftYmd,
  ymdInTz,
} from "../_shared/meta-normalize.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

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
    return json({ error: sel.kind, message: (sel as any).message }, 409);
  }

  const tz = sel.account.timezone || "America/Sao_Paulo";
  const today = ymdInTz(new Date(), tz);
  const defaultFrom = shiftYmd(today, -13, tz);
  const date_from = url.searchParams.get("date_from") || defaultFrom;
  const date_to = url.searchParams.get("date_to") || today;
  const breakdown = (url.searchParams.get("breakdown") || "country").toLowerCase() === "region"
    ? "region"
    : "country";

  const timeRange = encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }));
  const acct = sel.account.graph_id;
  const token = encodeURIComponent(sel.token);

  const fields = "spend,impressions,reach,clicks,actions";
  const bd = encodeURIComponent(breakdown);

  const warnings: string[] = [];
  let rows: any[] = [];
  try {
    const r = await fetch(
      `${GRAPH}/${acct}/insights?fields=${fields}&breakdowns=${bd}&time_range=${timeRange}&limit=200&access_token=${token}`,
    );
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    rows = j.data ?? [];
  } catch (e) {
    warnings.push(`geo: ${sanitizeMetaError(e)}`);
  }

  const points = rows.map((row: any) => {
    const key = String(row[breakdown] ?? "").toUpperCase();
    return {
      code: key,
      spend: safeNum(row.spend) ?? 0,
      impressions: safeNum(row.impressions) ?? 0,
      reach: safeNum(row.reach) ?? 0,
      clicks: safeNum(row.clicks) ?? 0,
      leads: extractLeadCount(row.actions),
    };
  }).filter((p) => p.code);

  logEvent("meta.geo.loaded", {
    request_id: requestId,
    organization_id: orgId,
    duration_ms: Date.now() - started,
    rows: points.length,
    breakdown,
  });

  return json({
    breakdown,
    period: { date_from, date_to },
    points,
    warnings,
    request_id: requestId,
  });
});
