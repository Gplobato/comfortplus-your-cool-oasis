// Meta Marketing API normalizers + structured logging.
// Policy: "Lead" = union of the canonical lead action types below (dedup by action_type).
// Never sum incompatible action types twice; a caller passes a single list.

export const LEAD_ACTION_TYPES = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "messaging_conversation_started_7d",
  "contact",
  "complete_registration",
] as const;

export const PURCHASE_ACTION_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
] as const;

export const LINK_CLICK_ACTION_TYPES = [
  "link_click",
  "outbound_click",
  "unique_outbound_click",
] as const;

export const ENGAGEMENT_ACTION_TYPES = [
  "post_engagement",
  "page_engagement",
  "post_interaction_gross",
  "onsite_conversion.post_save",
] as const;

export const APP_INSTALL_ACTION_TYPES = [
  "mobile_app_install",
  "app_install",
  "omni_app_install",
] as const;

type Action = { action_type: string; value: string | number };
type CostPerAction = { action_type: string; value: string | number };
type RoasEntry = { action_type: string; value: string | number };

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Returns null when metric is unavailable (not zero). */
export function safeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumByTypes(list: Action[] | undefined, types: readonly string[]): number {
  if (!Array.isArray(list)) return 0;
  const set = new Set<string>(types);
  const seen = new Set<string>(); // dedup by action_type
  let total = 0;
  for (const a of list) {
    const t = String(a.action_type);
    if (!set.has(t) || seen.has(t)) continue;
    seen.add(t);
    total += num(a.value);
  }
  return total;
}

function firstCostByTypes(
  costPerActionType: CostPerAction[] | undefined,
  types: readonly string[],
): number | null {
  if (!Array.isArray(costPerActionType)) return null;
  const allowed = new Set<string>(types);
  for (const c of costPerActionType) {
    if (!allowed.has(String(c.action_type))) continue;
    const v = safeNum(c.value);
    if (v !== null) return v;
  }
  return null;
}

export function extractLeadCount(actions: Action[] | undefined): number {
  return sumByTypes(actions, LEAD_ACTION_TYPES);
}

export function extractConversionCount(actions: Action[] | undefined): number {
  return sumByTypes(actions, PURCHASE_ACTION_TYPES);
}

export function extractPurchaseValue(actionValues: Action[] | undefined): number {
  return sumByTypes(actionValues, PURCHASE_ACTION_TYPES);
}

export function extractLinkClicks(actions: Action[] | undefined): number {
  // Prefer link_click; fall back to outbound_click
  const link = sumByTypes(actions, ["link_click"]);
  if (link > 0) return link;
  return sumByTypes(actions, ["outbound_click"]);
}

/** Meta returns purchase_roas as an array; pick the highest value across canonical purchase types. */
export function extractRoas(purchaseRoas: RoasEntry[] | undefined): number | null {
  if (!Array.isArray(purchaseRoas) || purchaseRoas.length === 0) return null;
  const allowed = new Set<string>(PURCHASE_ACTION_TYPES);
  let best: number | null = null;
  for (const r of purchaseRoas) {
    if (!allowed.has(String(r.action_type))) continue;
    const v = safeNum(r.value);
    if (v === null) continue;
    if (best === null || v > best) best = v;
  }
  // Fallback: any entry if none matched
  if (best === null) {
    for (const r of purchaseRoas) {
      const v = safeNum(r.value);
      if (v === null) continue;
      if (best === null || v > best) best = v;
    }
  }
  return best;
}

/** Weighted CPL from Meta's cost_per_action_type. Falls back to spend/leads when unavailable. */
export function extractCostPerLead(
  costPerActionType: CostPerAction[] | undefined,
  spend: number | null,
  leads: number,
): number | null {
  const fromMeta = firstCostByTypes(costPerActionType, LEAD_ACTION_TYPES);
  if (fromMeta !== null) return fromMeta;
  if (leads > 0 && spend !== null) return spend / leads;
  return null;
}

/** Normalize Meta objective strings (OUTCOME_LEADS → leads). */
export function normalizeObjective(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/^outcome_/, "")
    .replace(/^app_/, "app_");
}

/**
 * "Results" aligned with Ads Manager primary result by objective.
 * Falls back to leads → purchases → link clicks.
 */
export function extractResults(
  actions: Action[] | undefined,
  objective?: string | null,
): { results: number; result_type: string } {
  const obj = normalizeObjective(objective);
  if (obj.includes("lead") || obj.includes("message") || obj === "leads") {
    return { results: extractLeadCount(actions), result_type: "lead" };
  }
  if (obj.includes("sale") || obj.includes("conversion") || obj.includes("catalog") || obj === "sales") {
    return { results: extractConversionCount(actions), result_type: "purchase" };
  }
  if (obj.includes("traffic") || obj.includes("link")) {
    return { results: extractLinkClicks(actions), result_type: "link_click" };
  }
  if (obj.includes("engagement") || obj.includes("post")) {
    return { results: sumByTypes(actions, ENGAGEMENT_ACTION_TYPES), result_type: "engagement" };
  }
  if (obj.includes("app")) {
    return { results: sumByTypes(actions, APP_INSTALL_ACTION_TYPES), result_type: "app_install" };
  }
  // awareness / video / unknown — prefer leads, then purchases, then link clicks
  const leads = extractLeadCount(actions);
  if (leads > 0) return { results: leads, result_type: "lead" };
  const purchases = extractConversionCount(actions);
  if (purchases > 0) return { results: purchases, result_type: "purchase" };
  const clicks = extractLinkClicks(actions);
  if (clicks > 0) return { results: clicks, result_type: "link_click" };
  return { results: 0, result_type: "unknown" };
}

/** Cost per result (CPR) — Ads Manager style. */
export function extractCostPerResult(
  costPerActionType: CostPerAction[] | undefined,
  spend: number | null,
  results: number,
  resultType: string,
): number | null {
  const typeMap: Record<string, readonly string[]> = {
    lead: LEAD_ACTION_TYPES,
    purchase: PURCHASE_ACTION_TYPES,
    link_click: LINK_CLICK_ACTION_TYPES,
    engagement: ENGAGEMENT_ACTION_TYPES,
    app_install: APP_INSTALL_ACTION_TYPES,
  };
  const types = typeMap[resultType];
  if (types) {
    const fromMeta = firstCostByTypes(costPerActionType, types);
    if (fromMeta !== null) return fromMeta;
  }
  if (results > 0 && spend !== null) return spend / results;
  return null;
}

/** Meta budgets are in the account's smallest currency unit (cents for BRL/USD). */
export function budgetFromMeta(v: unknown): number | null {
  const n = safeNum(v);
  if (n === null) return null;
  return n / 100;
}

/** YYYY-MM-DD in a timezone (default America/Sao_Paulo). Avoids UTC day-shift. */
export function ymdInTz(d: Date = new Date(), timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shiftYmd(ymd: string, days: number, timeZone = "America/Sao_Paulo"): string {
  // Interpret ymd as noon UTC then shift — good enough for calendar days
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymdInTz(dt, timeZone);
}

export function periodLabel(dateFrom: string, dateTo: string): string {
  const diff =
    Math.round(
      (new Date(dateTo + "T12:00:00Z").getTime() -
        new Date(dateFrom + "T12:00:00Z").getTime()) /
        (24 * 3600 * 1000),
    ) + 1;
  if (diff <= 1) return "Hoje";
  return `Últimos ${diff} dias`;
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) {
    if (!Number.isFinite(current) || current === 0) return null;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ---------- Structured logging ----------

type LogEvent =
  | "meta.status.loaded"
  | "meta.assets.loaded"
  | "meta.account.selected"
  | "meta.sync.started"
  | "meta.sync.completed"
  | "meta.sync.failed"
  | "meta.dashboard.requested"
  | "meta.dashboard.loaded"
  | "meta.dashboard.failed"
  | "meta.campaigns.loaded"
  | "meta.campaigns.failed";

export function logEvent(event: LogEvent, fields: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (/token|secret|access|encrypted/i.test(k)) continue;
    sanitized[k] = v;
  }
  try {
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...sanitized }));
  } catch {
    console.log(event, sanitized);
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
