export type MetaActionPolicy = {
  autonomy_level: number;
  allow_direct_pause: boolean;
  allow_direct_paused_drafts: boolean;
  require_approval_activation: boolean;
  require_approval_budget: boolean;
  max_daily_budget_brl: number | null;
  max_budget_change_percent: number;
};

export const CONSERVATIVE_META_POLICY: MetaActionPolicy = {
  autonomy_level: 3,
  allow_direct_pause: true,
  allow_direct_paused_drafts: true,
  require_approval_activation: true,
  require_approval_budget: true,
  max_daily_budget_brl: null,
  max_budget_change_percent: 20,
};

const PAUSE_TOOLS = new Set(["meta.pause_campaign", "meta.pause_adset", "meta.pause_ad"]);
const PAUSED_DRAFT_TOOLS = new Set([
  "meta.create_campaign",
  "meta.create_adset",
  "meta.create_ad",
  "meta.create_campaign_structure",
  "meta.publish_creative_paused",
]);
const ACTIVATION_TOOLS = new Set(["meta.activate_campaign", "meta.activate_adset", "meta.activate_ad"]);
const BUDGET_TOOLS = new Set(["meta.update_campaign_budget", "meta.update_adset_budget"]);

export async function loadMetaActionPolicy(admin: any, organizationId: string): Promise<MetaActionPolicy> {
  const { data } = await admin
    .from("organization_ai_settings")
    .select(
      "autonomy_level, allow_direct_pause, allow_direct_paused_drafts, require_approval_activation, require_approval_budget, max_daily_budget_brl, max_budget_change_percent",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return CONSERVATIVE_META_POLICY;
  return {
    ...CONSERVATIVE_META_POLICY,
    ...data,
    max_daily_budget_brl: data.max_daily_budget_brl == null ? null : Number(data.max_daily_budget_brl),
    max_budget_change_percent: Number(data.max_budget_change_percent || 20),
  };
}

export function actionPolicyDecision(toolName: string, policy: MetaActionPolicy) {
  if (PAUSE_TOOLS.has(toolName)) {
    return {
      allowed: policy.autonomy_level >= 3 && policy.allow_direct_pause,
      requiresApproval: false,
      reason: "Pausas são reversíveis e permitidas pela política conservadora.",
    };
  }
  if (PAUSED_DRAFT_TOOLS.has(toolName)) {
    return {
      allowed: policy.autonomy_level >= 2 && policy.allow_direct_paused_drafts,
      requiresApproval: false,
      reason: "Rascunhos pausados não entram em veiculação.",
    };
  }
  if (ACTIVATION_TOOLS.has(toolName)) {
    return {
      allowed: true,
      requiresApproval: policy.require_approval_activation,
      reason: "Ativações podem gerar gasto e exigem aprovação humana.",
    };
  }
  if (BUDGET_TOOLS.has(toolName)) {
    return {
      allowed: true,
      requiresApproval: policy.require_approval_budget,
      reason: "Alterações financeiras exigem aprovação humana.",
    };
  }
  return { allowed: false, requiresApproval: true, reason: "Ação não permitida pela política da organização." };
}

export function assertBudgetWithinPolicy(
  policy: MetaActionPolicy,
  proposedDailyBudgetBrl: number | null,
  currentDailyBudgetBrl?: number | null,
) {
  if (proposedDailyBudgetBrl == null || !Number.isFinite(proposedDailyBudgetBrl) || proposedDailyBudgetBrl <= 0) {
    return { ok: false as const, error: "invalid_budget" };
  }
  if (policy.max_daily_budget_brl != null && proposedDailyBudgetBrl > policy.max_daily_budget_brl) {
    return { ok: false as const, error: "budget_above_organization_limit" };
  }
  if (currentDailyBudgetBrl && currentDailyBudgetBrl > 0) {
    const change = Math.abs((proposedDailyBudgetBrl - currentDailyBudgetBrl) / currentDailyBudgetBrl) * 100;
    if (change > policy.max_budget_change_percent) {
      return { ok: false as const, error: "budget_change_above_policy_limit" };
    }
  }
  return { ok: true as const };
}
