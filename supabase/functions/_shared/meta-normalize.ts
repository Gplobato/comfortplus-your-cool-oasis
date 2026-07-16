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

export function extractLeadCount(actions: Action[] | undefined): number {
  return sumByTypes(actions, LEAD_ACTION_TYPES);
}

export function extractConversionCount(actions: Action[] | undefined): number {
  return sumByTypes(actions, PURCHASE_ACTION_TYPES);
}

export function extractPurchaseValue(actionValues: Action[] | undefined): number {
  return sumByTypes(actionValues, PURCHASE_ACTION_TYPES);
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
  if (Array.isArray(costPerActionType)) {
    const allowed = new Set<string>(LEAD_ACTION_TYPES);
    for (const c of costPerActionType) {
      if (!allowed.has(String(c.action_type))) continue;
      const v = safeNum(c.value);
      if (v !== null) return v;
    }
  }
  if (leads > 0 && spend !== null) return spend / leads;
  return null;
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
