/** Parse / split Traffic Manager replies for UI (urgency + collapsible detail). */

export type MoneyLeftInsight = {
  amountBrl: number | null;
  period: string;
  reason: string;
  urgency: "alta" | "media" | "baixa";
  actionHint?: string;
};

const MONEY_RE = /<money_left>([\s\S]*?)<\/money_left>/i;

export function extractMoneyLeft(text: string): { insight: MoneyLeftInsight | null; cleaned: string } {
  const m = text.match(MONEY_RE);
  if (!m) return { insight: null, cleaned: text };
  let insight: MoneyLeftInsight | null = null;
  try {
    const raw = JSON.parse(m[1].trim());
    const urgencyRaw = String(raw.urgency || "media").toLowerCase();
    const urgency: MoneyLeftInsight["urgency"] =
      urgencyRaw.startsWith("alt") ? "alta" : urgencyRaw.startsWith("baix") ? "baixa" : "media";
    const amount = raw.amount_brl ?? raw.amountBrl ?? raw.amount;
    insight = {
      amountBrl: amount == null || amount === "" ? null : Number(amount),
      period: String(raw.period || "mês"),
      reason: String(raw.reason || raw.explanation || "").slice(0, 400),
      urgency,
      actionHint: raw.action_hint || raw.actionHint
        ? String(raw.action_hint || raw.actionHint).slice(0, 200)
        : undefined,
    };
  } catch {
    insight = null;
  }
  return { insight, cleaned: text.replace(MONEY_RE, "").trim() };
}

/** Split executive brief (top) from the rest for collapsible detail. */
export function splitExecutiveBrief(markdown: string): { brief: string; detail: string | null } {
  const text = markdown.trim();
  if (!text) return { brief: text, detail: null };

  // Prefer explicit --- separator after the short brief
  const hr = text.split(/\n---\n/);
  if (hr.length >= 2 && hr[0].trim().length > 40) {
    return { brief: hr[0].trim(), detail: hr.slice(1).join("\n---\n").trim() || null };
  }

  // Or: first ## block as brief, rest as detail if long enough
  const lines = text.split("\n");
  let firstHeading = -1;
  let secondHeading = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      if (firstHeading < 0) firstHeading = i;
      else if (secondHeading < 0) {
        secondHeading = i;
        break;
      }
    }
  }

  if (secondHeading > 0 && text.length > 700) {
    const brief = lines.slice(0, secondHeading).join("\n").trim();
    const detail = lines.slice(secondHeading).join("\n").trim();
    if (brief.length > 60 && detail.length > 120) {
      return { brief, detail };
    }
  }

  // Fallback: collapse by length
  if (text.length > 900 || lines.length > 18) {
    const cut = Math.min(12, Math.max(6, Math.floor(lines.length * 0.35)));
    return {
      brief: lines.slice(0, cut).join("\n").trim(),
      detail: lines.slice(cut).join("\n").trim(),
    };
  }

  return { brief: text, detail: null };
}
