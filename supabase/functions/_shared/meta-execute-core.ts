// Shared Meta write executor for approved proposals (pause ad/adset/campaign).
import { loadActiveSelection, sanitizeMetaError } from "./meta-ids.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const EXECUTABLE = new Set(["meta.pause_ad", "meta.pause_adset", "meta.pause_campaign"]);

async function graphPost(path: string, token: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(url.toString(), { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(sanitizeMetaError(data));
  }
  return data;
}

function hasAdsManagement(scopes: string[] | null | undefined): boolean {
  if (!scopes?.length) return false;
  return scopes.some((s) => s === "ads_management" || s.includes("ads_management"));
}

export type ExecuteResult =
  | { ok: true; status: string; already_done?: boolean; object_id?: string; tool_name?: string; message?: string; result?: unknown }
  | { ok: false; error: string; detail?: string; status?: number; message?: string };

export async function executeApprovedProposal(
  admin: any,
  opts: { organizationId: string; proposalId: string; userId: string },
): Promise<ExecuteResult> {
  const { organizationId: orgId, proposalId, userId } = opts;

  const { data: proposal, error: pErr } = await admin
    .from("action_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (pErr) return { ok: false, error: "proposal_load_failed", detail: pErr.message, status: 500 };
  if (!proposal) return { ok: false, error: "proposal_not_found", status: 404 };

  if (proposal.status === "completed") {
    return { ok: true, status: "completed", already_done: true };
  }
  if (proposal.status !== "approved" && proposal.status !== "executing") {
    return { ok: false, error: "proposal_not_approved", detail: proposal.status, status: 400 };
  }

  const tool = String(proposal.tool_name);
  if (!EXECUTABLE.has(tool)) {
    return {
      ok: true,
      status: "approved_only",
      message: "Esta ação foi aprovada, mas a execução automática ainda não está disponível para este tipo.",
      tool_name: tool,
    };
  }

  const args = (proposal.proposed_arguments ?? {}) as Record<string, unknown>;
  const targetId = String(
    args.ad_id || args.adset_id || args.campaign_id || args.object_id || "",
  ).trim();
  if (!targetId) {
    return {
      ok: false,
      error: "missing_target_id",
      detail: "proposed_arguments precisa de ad_id/adset_id/campaign_id",
      status: 400,
    };
  }

  const selection = await loadActiveSelection(admin, orgId);
  if ("kind" in selection) {
    return { ok: false, error: selection.kind, detail: (selection as any).message, status: 400 };
  }

  if (!hasAdsManagement(selection.connection.granted_scopes)) {
    return {
      ok: false,
      error: "missing_ads_management_scope",
      message: "Reconecte a Meta em Integrações para conceder ads_management (escrita).",
      status: 403,
    };
  }

  await admin.from("action_proposals").update({ status: "executing" }).eq("id", proposalId);

  const idempotencyKey = `exec_${proposalId}_${tool}_${targetId}`;
  const { data: existing } = await admin
    .from("action_executions")
    .select("id, status, sanitized_result")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.status === "succeeded" || existing?.status === "verified") {
    await admin.from("action_proposals").update({ status: "completed" }).eq("id", proposalId);
    return {
      ok: true,
      status: "completed",
      already_done: true,
      result: existing.sanitized_result,
    };
  }

  let executionId = existing?.id as string | undefined;
  if (!executionId) {
    const { data: execution, error: eIns } = await admin
      .from("action_executions")
      .insert({
        proposal_id: proposalId,
        organization_id: orgId,
        tool_name: tool,
        sanitized_arguments: { object_id: targetId, action: "PAUSED" },
        idempotency_key: idempotencyKey,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (eIns) console.error("execution insert", eIns);
    executionId = execution?.id;
  } else {
    await admin
      .from("action_executions")
      .update({ status: "running", started_at: new Date().toISOString(), error_message_sanitized: null })
      .eq("id", executionId);
  }

  try {
    const result = await graphPost(targetId, selection.token, { status: "PAUSED" });

    if (executionId) {
      await admin
        .from("action_executions")
        .update({
          status: "succeeded",
          sanitized_result: { success: true, graph: { success: result?.success ?? true } },
          completed_at: new Date().toISOString(),
          verification_status: "unverified",
        })
        .eq("id", executionId);
    }

    await admin.from("action_proposals").update({ status: "completed" }).eq("id", proposalId);

    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: userId,
      agent_id: "meta-execute",
      event_type: "meta.write.pause",
      entity_type: tool.replace("meta.", ""),
      entity_id: targetId,
      action: "PAUSED",
      sanitized_metadata: { proposal_id: proposalId, tool_name: tool },
    });

    return { ok: true, status: "completed", object_id: targetId, tool_name: tool };
  } catch (err: any) {
    const msg = String(err?.message ?? err).slice(0, 300);
    if (executionId) {
      await admin
        .from("action_executions")
        .update({
          status: "failed",
          error_message_sanitized: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }
    await admin.from("action_proposals").update({ status: "failed" }).eq("id", proposalId);

    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: userId,
      agent_id: "meta-execute",
      event_type: "meta.write.pause_failed",
      entity_type: tool.replace("meta.", ""),
      entity_id: targetId,
      action: "PAUSED",
      sanitized_metadata: { proposal_id: proposalId, error: msg },
    });

    return { ok: false, error: "meta_write_failed", detail: msg, status: 502 };
  }
}
