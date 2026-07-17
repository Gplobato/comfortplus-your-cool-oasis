// Parse and persist Traffic Manager action proposals.

export type ProposedAction = {
  action_type: string;
  tool_name: string;
  title: string;
  explanation?: string;
  rationale?: string;
  risk_level?: "read" | "draft" | "reversible" | "financial" | "destructive";
  estimated_impact?: string;
  proposed_arguments?: Record<string, unknown>;
  current_state?: Record<string, unknown> | null;
  proposed_state?: Record<string, unknown> | null;
};

const ALLOWED_TOOLS = new Set([
  "meta.pause_ad",
  "meta.pause_adset",
  "meta.pause_campaign",
  "meta.budget_change",
]);

const TOOL_RISK: Record<string, ProposedAction["risk_level"]> = {
  "meta.pause_ad": "reversible",
  "meta.pause_adset": "reversible",
  "meta.pause_campaign": "reversible",
  "meta.budget_change": "financial",
};

export function extractProposeActions(text: string): { actions: ProposedAction[]; cleaned: string } {
  const actions: ProposedAction[] = [];
  let cleaned = text;
  const re = /<propose_action>([\s\S]*?)<\/propose_action>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const tool = String(parsed.tool_name || "").trim();
      if (!ALLOWED_TOOLS.has(tool)) continue;
      const title = String(parsed.title || "").trim();
      if (!title) continue;
      actions.push({
        action_type: String(parsed.action_type || tool.replace(/^meta\./, "")),
        tool_name: tool,
        title: title.slice(0, 200),
        explanation: parsed.explanation ? String(parsed.explanation).slice(0, 2000) : undefined,
        rationale: parsed.rationale ? String(parsed.rationale).slice(0, 2000) : undefined,
        risk_level: TOOL_RISK[tool] || parsed.risk_level || "reversible",
        estimated_impact: parsed.estimated_impact
          ? String(parsed.estimated_impact).slice(0, 500)
          : undefined,
        proposed_arguments: (parsed.proposed_arguments && typeof parsed.proposed_arguments === "object")
          ? parsed.proposed_arguments
          : {},
        current_state: parsed.current_state ?? null,
        proposed_state: parsed.proposed_state ?? null,
      });
    } catch {
      // ignore malformed blocks
    }
  }
  cleaned = cleaned.replace(re, "").trim();
  return { actions, cleaned };
}

export async function insertProposals(
  admin: { from: (t: string) => any },
  opts: {
    organizationId: string;
    userId: string;
    adAccountAssetId?: string | null;
    actions: ProposedAction[];
    agent?: string;
  },
): Promise<{ id: string; title: string; tool_name: string; action_type: string }[]> {
  const created: { id: string; title: string; tool_name: string; action_type: string }[] = [];
  for (const a of opts.actions.slice(0, 5)) {
    const { data, error } = await admin
      .from("action_proposals")
      .insert({
        organization_id: opts.organizationId,
        ad_account_asset_id: opts.adAccountAssetId ?? null,
        created_by_agent: opts.agent ?? "traffic_manager",
        requested_by_user_id: opts.userId,
        action_type: a.action_type,
        title: a.title,
        explanation: a.explanation ?? null,
        rationale: a.rationale ?? null,
        tool_name: a.tool_name,
        proposed_arguments: a.proposed_arguments ?? {},
        current_state: a.current_state ?? null,
        proposed_state: a.proposed_state ?? null,
        risk_level: a.risk_level ?? "reversible",
        estimated_impact: a.estimated_impact ?? null,
        status: "awaiting_approval",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, title, tool_name, action_type")
      .single();
    if (error) {
      console.error("insert proposal failed", error);
      continue;
    }
    if (data) created.push(data);
  }
  return created;
}
