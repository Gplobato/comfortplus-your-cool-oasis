import { loadActiveSelection, normalizeMetaAdAccountId, sanitizeMetaError } from "./meta-ids.ts";
import {
  actionPolicyDecision,
  assertBudgetWithinPolicy,
  loadMetaActionPolicy,
} from "./meta-policy.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const PAUSE_TOOLS = new Set(["meta.pause_ad", "meta.pause_adset", "meta.pause_campaign"]);
const ACTIVATE_TOOLS = new Set(["meta.activate_ad", "meta.activate_adset", "meta.activate_campaign"]);
const ACTIVATE_STRUCTURE_TOOLS = new Set(["meta.activate_campaign_structure"]);
const BUDGET_TOOLS = new Set(["meta.update_campaign_budget", "meta.update_adset_budget"]);
const CREATE_TOOLS = new Set([
  "meta.create_campaign",
  "meta.create_adset",
  "meta.create_ad",
  "meta.create_campaign_structure",
  "meta.publish_creative_paused",
]);
const SUPPORTED_TOOLS = new Set([
  ...PAUSE_TOOLS,
  ...ACTIVATE_TOOLS,
  ...ACTIVATE_STRUCTURE_TOOLS,
  ...BUDGET_TOOLS,
  ...CREATE_TOOLS,
]);
const OBJECTIVES = new Set([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION",
  "OUTCOME_SALES",
]);

type Json = Record<string, unknown>;

export type ExecuteResult =
  | {
      ok: true;
      status: string;
      proposal_id?: string;
      execution_id?: string;
      already_done?: boolean;
      object_id?: string;
      tool_name?: string;
      message?: string;
      result?: unknown;
    }
  | { ok: false; error: string; detail?: string; status?: number; message?: string };

async function graphJson(
  path: string,
  token: string,
  method: "GET" | "POST" = "GET",
  params: Record<string, string> = {},
) {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  const payload = { ...params, access_token: token };
  let response: Response;
  if (method === "GET") {
    for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, value);
    response = await fetch(url.toString());
  } else {
    response = await fetch(url.toString(), { method: "POST", body: new URLSearchParams(payload) });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(sanitizeMetaError(data));
  return data;
}

async function graphUpload(path: string, token: string, field: string, bytes: Blob, fileName: string, extra: Record<string, string> = {}) {
  const body = new FormData();
  body.append("access_token", token);
  body.append(field, bytes, fileName);
  for (const [key, value] of Object.entries(extra)) body.append(key, value);
  const response = await fetch(`${GRAPH}/${path.replace(/^\//, "")}`, { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(sanitizeMetaError(data));
  return data;
}

function text(value: unknown, max = 250) {
  return String(value ?? "").trim().slice(0, max);
}

function required(value: unknown, field: string) {
  const result = text(value);
  if (!result) throw new Error(`missing_${field}`);
  return result;
}

function positiveMoney(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`invalid_${field}`);
  return number;
}

function cents(value: unknown, field: string) {
  return String(Math.round(positiveMoney(value, field) * 100));
}

function jsonParam(value: unknown, field: string) {
  if (!value || typeof value !== "object") throw new Error(`invalid_${field}`);
  return JSON.stringify(value);
}

function hasAdsManagement(scopes: string[] | null | undefined) {
  return !!scopes?.some((scope) => scope === "ads_management" || scope.includes("ads_management"));
}

function targetId(args: Json) {
  return text(args.ad_id || args.adset_id || args.campaign_id || args.object_id);
}

async function assertOwnedObject(id: string, token: string, expectedAccountId: string) {
  const object = await graphJson(id, token, "GET", { fields: "id,account_id,status,daily_budget,lifetime_budget" });
  const actual = normalizeMetaAdAccountId(String(object.account_id ?? ""));
  if (actual && actual !== normalizeMetaAdAccountId(expectedAccountId)) throw new Error("object_not_owned_by_selected_account");
  return object;
}

async function verifyObject(id: string, token: string) {
  const object = await graphJson(id, token, "GET", { fields: "id,status,effective_status,daily_budget,lifetime_budget,name" });
  return {
    id: text(object.id),
    status: text(object.status || object.effective_status),
    daily_budget: object.daily_budget ?? null,
    lifetime_budget: object.lifetime_budget ?? null,
    name: text(object.name),
  };
}

async function publishCreativePaused(admin: any, selection: any, orgId: string, userId: string, args: Json) {
  const creativeId = required(args.creative_id, "creative_id");
  const adsetId = required(args.adset_id, "adset_id");
  const pageId = required(args.page_id, "page_id");
  await assertOwnedObject(adsetId, selection.token, selection.account.account_id);
  const { data: pageAsset } = await admin
    .from("meta_assets")
    .select("id")
    .eq("connection_id", selection.connection.id)
    .eq("asset_type", "page")
    .eq("external_id", pageId)
    .maybeSingle();
  if (!pageAsset) throw new Error("page_not_available_on_connection");

  const { data: creative, error } = await admin
    .from("creatives")
    .select("*")
    .eq("id", creativeId)
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !creative) throw new Error("creative_not_found");

  const destinationUrl = text(args.destination_url || creative.destination_url, 2000);
  if (!/^https?:\/\//i.test(destinationUrl)) throw new Error("invalid_destination_url");
  const cta = text(args.cta || creative.cta || "LEARN_MORE", 50);
  let bytes: Blob;
  let fileName = "creative";
  if (creative.storage_path) {
    const download = await admin.storage.from("creative-assets").download(creative.storage_path);
    if (download.error || !download.data) throw new Error("creative_asset_download_failed");
    bytes = download.data;
    fileName = creative.storage_path.split("/").pop() || fileName;
  } else {
    const mediaUrl = text(creative.media_url || creative.thumbnail_url, 2000);
    if (!/^https?:\/\//i.test(mediaUrl)) throw new Error("creative_asset_missing");
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error("creative_asset_download_failed");
    bytes = await response.blob();
    fileName = new URL(mediaUrl).pathname.split("/").pop() || fileName;
  }

  const isVideo = String(creative.mime_type || creative.type).includes("video");
  let assetReference: Json;
  if (isVideo) {
    const uploaded = await graphUpload(`${selection.account.graph_id}/advideos`, selection.token, "source", bytes, fileName, {
      title: text(creative.name),
    });
    assetReference = { video_id: required(uploaded.id, "video_id") };
  } else {
    const uploaded = await graphUpload(`${selection.account.graph_id}/adimages`, selection.token, "filename", bytes, fileName);
    const image = Object.values(uploaded.images ?? {})[0] as any;
    assetReference = { image_hash: required(image?.hash, "image_hash") };
  }

  const storyData: Json = {
    ...assetReference,
    link: destinationUrl,
    message: text(args.primary_text || creative.primary_text, 5000),
    name: text(args.headline || creative.headline || creative.name),
    call_to_action: { type: cta, value: { link: destinationUrl } },
  };
  const storySpec = {
    page_id: pageId,
    [isVideo ? "video_data" : "link_data"]: storyData,
  };
  const createdCreative = await graphJson(`${selection.account.graph_id}/adcreatives`, selection.token, "POST", {
    name: `${text(creative.name)} · ProAds`,
    object_story_spec: JSON.stringify(storySpec),
  });
  const metaCreativeId = required(createdCreative.id, "meta_creative_id");
  const createdAd = await graphJson(`${selection.account.graph_id}/ads`, selection.token, "POST", {
    name: text(args.ad_name || `${creative.name} · pausado`),
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: metaCreativeId }),
    status: "PAUSED",
  });
  const adId = required(createdAd.id, "meta_ad_id");
  const verified = await verifyObject(adId, selection.token);
  if (verified.status && !["PAUSED", "IN_PROCESS", "PENDING_REVIEW"].includes(verified.status)) {
    throw new Error("created_ad_not_paused");
  }

  await admin.from("creative_campaign_links").upsert({
    organization_id: orgId,
    creative_id: creativeId,
    campaign_external_id: required(args.campaign_id, "campaign_id"),
    campaign_name: text(args.campaign_name) || null,
    adset_external_id: adsetId,
    adset_name: text(args.adset_name) || null,
    meta_creative_id: metaCreativeId,
    meta_ad_id: adId,
    publication_status: "published",
    publication_error: null,
    created_by: userId,
  }, { onConflict: "creative_id,campaign_external_id,adset_external_id" });
  await admin.from("creatives").update({ publication_status: "published", status: "approved" }).eq("id", creativeId);
  return { object_id: adId, ad_id: adId, meta_creative_id: metaCreativeId, verification: verified };
}

async function executeTool(admin: any, selection: any, orgId: string, userId: string, tool: string, args: Json) {
  if (PAUSE_TOOLS.has(tool) || ACTIVATE_TOOLS.has(tool)) {
    const id = required(targetId(args), "target_id");
    await assertOwnedObject(id, selection.token, selection.account.account_id);
    const status = PAUSE_TOOLS.has(tool) ? "PAUSED" : "ACTIVE";
    await graphJson(id, selection.token, "POST", { status });
    const verification = await verifyObject(id, selection.token);
    return { object_id: id, requested_status: status, verification };
  }

  if (ACTIVATE_STRUCTURE_TOOLS.has(tool)) {
    const campaignId = required(args.campaign_id, "campaign_id");
    await assertOwnedObject(campaignId, selection.token, selection.account.account_id);
    const adsetIds = Array.isArray(args.adset_ids)
      ? [...new Set(args.adset_ids.map((id) => text(id)).filter(Boolean))]
      : [];
    const adIds = Array.isArray(args.ad_ids)
      ? [...new Set(args.ad_ids.map((id) => text(id)).filter(Boolean))]
      : [];
    const expectedAccount = normalizeMetaAdAccountId(selection.account.account_id);

    for (const adsetId of adsetIds) {
      const adset = await graphJson(adsetId, selection.token, "GET", {
        fields: "id,account_id,campaign_id,status,effective_status",
      });
      if (
        normalizeMetaAdAccountId(String(adset.account_id ?? "")) !== expectedAccount ||
        text(adset.campaign_id) !== campaignId
      ) {
        throw new Error("adset_not_owned_by_campaign");
      }
    }
    for (const adId of adIds) {
      const ad = await graphJson(adId, selection.token, "GET", {
        fields: "id,account_id,campaign_id,adset_id,status,effective_status",
      });
      if (
        normalizeMetaAdAccountId(String(ad.account_id ?? "")) !== expectedAccount ||
        text(ad.campaign_id) !== campaignId ||
        (adsetIds.length > 0 && !adsetIds.includes(text(ad.adset_id)))
      ) {
        throw new Error("ad_not_owned_by_campaign_structure");
      }
    }

    const activated: Array<{ type: string; id: string; verification: unknown }> = [];
    const failures: Array<{ type: string; id: string; error: string }> = [];
    const activate = async (type: string, id: string) => {
      try {
        await graphJson(id, selection.token, "POST", { status: "ACTIVE" });
        activated.push({ type, id, verification: await verifyObject(id, selection.token) });
      } catch (error) {
        failures.push({
          type,
          id,
          error: text(error instanceof Error ? error.message : error, 300),
        });
      }
    };

    for (const adId of adIds) await activate("ad", adId);
    for (const adsetId of adsetIds) await activate("adset", adsetId);
    await activate("campaign", campaignId);

    return {
      object_id: campaignId,
      campaign_id: campaignId,
      activated,
      failures,
      partial_failure: failures.length > 0,
      rollback_reference: failures.length > 0
        ? "Revise os itens com falha; os itens ativados podem ser pausados individualmente."
        : null,
    };
  }

  if (BUDGET_TOOLS.has(tool)) {
    const id = required(targetId(args), "target_id");
    const current = await assertOwnedObject(id, selection.token, selection.account.account_id);
    const budgetBrl = positiveMoney(args.daily_budget_brl, "daily_budget_brl");
    const policy = await loadMetaActionPolicy(admin, orgId);
    const limit = assertBudgetWithinPolicy(
      policy,
      budgetBrl,
      current.daily_budget == null ? null : Number(current.daily_budget) / 100,
    );
    if (!limit.ok) throw new Error(limit.error);
    await graphJson(id, selection.token, "POST", { daily_budget: cents(budgetBrl, "daily_budget_brl") });
    return { object_id: id, daily_budget_brl: budgetBrl, verification: await verifyObject(id, selection.token) };
  }

  if (tool === "meta.create_campaign") {
    const objective = required(args.objective, "objective").toUpperCase();
    if (!OBJECTIVES.has(objective)) throw new Error("unsupported_objective");
    const result = await graphJson(`${selection.account.graph_id}/campaigns`, selection.token, "POST", {
      name: required(args.name, "name"),
      objective,
      buying_type: text(args.buying_type || "AUCTION"),
      special_ad_categories: JSON.stringify(Array.isArray(args.special_ad_categories) ? args.special_ad_categories : []),
      status: "PAUSED",
    });
    const id = required(result.id, "campaign_id");
    return { object_id: id, campaign_id: id, verification: await verifyObject(id, selection.token) };
  }

  if (tool === "meta.create_adset") {
    await assertOwnedObject(required(args.campaign_id, "campaign_id"), selection.token, selection.account.account_id);
    const params: Record<string, string> = {
      campaign_id: required(args.campaign_id, "campaign_id"),
      name: required(args.name, "name"),
      billing_event: text(args.billing_event || "IMPRESSIONS"),
      optimization_goal: required(args.optimization_goal, "optimization_goal"),
      targeting: jsonParam(args.targeting, "targeting"),
      status: "PAUSED",
    };
    if (args.daily_budget_brl != null) params.daily_budget = cents(args.daily_budget_brl, "daily_budget_brl");
    if (args.lifetime_budget_brl != null) params.lifetime_budget = cents(args.lifetime_budget_brl, "lifetime_budget_brl");
    if (args.start_time) params.start_time = required(args.start_time, "start_time");
    if (args.end_time) params.end_time = required(args.end_time, "end_time");
    if (args.promoted_object) params.promoted_object = jsonParam(args.promoted_object, "promoted_object");
    const result = await graphJson(`${selection.account.graph_id}/adsets`, selection.token, "POST", params);
    const id = required(result.id, "adset_id");
    return { object_id: id, adset_id: id, verification: await verifyObject(id, selection.token) };
  }

  if (tool === "meta.create_ad") {
    const adsetId = required(args.adset_id, "adset_id");
    await assertOwnedObject(adsetId, selection.token, selection.account.account_id);
    const result = await graphJson(`${selection.account.graph_id}/ads`, selection.token, "POST", {
      adset_id: adsetId,
      name: required(args.name, "name"),
      creative: JSON.stringify({ creative_id: required(args.meta_creative_id, "meta_creative_id") }),
      status: "PAUSED",
    });
    const id = required(result.id, "ad_id");
    return { object_id: id, ad_id: id, verification: await verifyObject(id, selection.token) };
  }

  if (tool === "meta.create_campaign_structure") {
    const campaign = await executeTool(admin, selection, orgId, userId, "meta.create_campaign", args.campaign as Json);
    try {
      const adsetArgs = { ...(args.adset as Json), campaign_id: campaign.campaign_id };
      const adset = await executeTool(admin, selection, orgId, userId, "meta.create_adset", adsetArgs);
      let ad: Json | null = null;
      if (args.ad) {
        const adArgs = { ...(args.ad as Json), adset_id: adset.adset_id };
        ad = await executeTool(admin, selection, orgId, userId, "meta.create_ad", adArgs);
      }
      return { object_id: campaign.campaign_id, campaign, adset, ad, all_paused: true };
    } catch (error) {
      return {
        object_id: campaign.campaign_id,
        campaign,
        partial_failure: true,
        error: text(error instanceof Error ? error.message : error),
        rollback_reference: `Campanha ${campaign.campaign_id} permaneceu pausada`,
      };
    }
  }

  if (tool === "meta.publish_creative_paused") {
    return publishCreativePaused(admin, selection, orgId, userId, args);
  }
  throw new Error("unsupported_tool");
}

function proposalRisk(tool: string) {
  if (PAUSE_TOOLS.has(tool)) return "reversible";
  if (CREATE_TOOLS.has(tool)) return "draft";
  return "financial";
}

export async function submitMetaAction(
  admin: any,
  opts: {
    organizationId: string;
    userId: string;
    toolName: string;
    arguments: Json;
    title?: string;
    explanation?: string;
    idempotencyKey?: string;
  },
): Promise<ExecuteResult> {
  const tool = text(opts.toolName, 100);
  if (!SUPPORTED_TOOLS.has(tool)) return { ok: false, error: "unsupported_tool", status: 400 };
  const policy = await loadMetaActionPolicy(admin, opts.organizationId);
  const decision = actionPolicyDecision(tool, policy);
  if (!decision.allowed) return { ok: false, error: "action_blocked_by_policy", detail: decision.reason, status: 403 };

  // Repeated status changes are legitimate (pause → activate → pause). Only
  // reuse an intent when the caller explicitly supplies a stable key.
  const key = opts.idempotencyKey || crypto.randomUUID();
  const { data: existing } = await admin
    .from("action_proposals")
    .select("id,status,execution_mode")
    .eq("organization_id", opts.organizationId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing) {
    if (existing.status === "awaiting_approval") {
      return { ok: true, status: "awaiting_approval", proposal_id: existing.id, already_done: true };
    }
    if (["completed", "executing", "approved"].includes(existing.status)) {
      return { ok: true, status: existing.status, proposal_id: existing.id, already_done: true };
    }
  }

  const status = decision.requiresApproval ? "awaiting_approval" : "approved";
  const proposalPayload = {
    organization_id: opts.organizationId,
    requested_by_user_id: opts.userId,
    created_by_agent: "proads-ui",
    action_type: tool.replace("meta.", ""),
    title: text(opts.title || tool.replace("meta.", "").replaceAll("_", " ")),
    explanation: text(opts.explanation || decision.reason, 1000),
    rationale: decision.reason,
    tool_name: tool,
    proposed_arguments: opts.arguments,
    risk_level: proposalRisk(tool),
    status,
    execution_mode: decision.requiresApproval ? "approval" : "direct",
    idempotency_key: key,
    reviewed_by_user_id: decision.requiresApproval ? null : opts.userId,
    reviewed_at: decision.requiresApproval ? null : new Date().toISOString(),
  };
  const { data: proposal, error } = existing
    ? await admin.from("action_proposals").update(proposalPayload).eq("id", existing.id).select("id").single()
    : await admin.from("action_proposals").insert(proposalPayload).select("id").single();
  if (error || !proposal) return { ok: false, error: "proposal_create_failed", detail: error?.message, status: 500 };
  if (decision.requiresApproval) {
    return {
      ok: true,
      status: "awaiting_approval",
      proposal_id: proposal.id,
      tool_name: tool,
      message: decision.reason,
    };
  }
  return executeApprovedProposal(admin, {
    organizationId: opts.organizationId,
    proposalId: proposal.id,
    userId: opts.userId,
  });
}

export async function executeApprovedProposal(
  admin: any,
  opts: { organizationId: string; proposalId: string; userId: string },
): Promise<ExecuteResult> {
  const { organizationId: orgId, proposalId, userId } = opts;
  const { data: proposal, error: loadError } = await admin
    .from("action_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (loadError) return { ok: false, error: "proposal_load_failed", detail: loadError.message, status: 500 };
  if (!proposal) return { ok: false, error: "proposal_not_found", status: 404 };
  if (proposal.status === "completed") return { ok: true, status: "completed", proposal_id: proposalId, already_done: true };
  if (!["approved", "executing", "failed", "partially_completed"].includes(proposal.status)) {
    return { ok: false, error: "proposal_not_approved", detail: proposal.status, status: 400 };
  }

  const tool = text(proposal.tool_name, 100);
  if (!SUPPORTED_TOOLS.has(tool)) return { ok: false, error: "unsupported_tool", detail: tool, status: 400 };
  const policy = await loadMetaActionPolicy(admin, orgId);
  const decision = actionPolicyDecision(tool, policy);
  if (!decision.allowed) return { ok: false, error: "action_blocked_by_policy", detail: decision.reason, status: 403 };

  const selection = await loadActiveSelection(admin, orgId);
  if ("kind" in selection) return { ok: false, error: selection.kind, detail: (selection as any).message, status: 400 };
  if (!hasAdsManagement(selection.connection.granted_scopes)) {
    return {
      ok: false,
      error: "missing_ads_management_scope",
      message: "Reconecte a Meta para conceder ads_management.",
      status: 403,
    };
  }

  const args = (proposal.proposed_arguments ?? {}) as Json;
  const key = proposal.idempotency_key || `exec_${proposalId}_${tool}`;
  const { data: existing } = await admin
    .from("action_executions")
    .select("id,status,sanitized_result")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (["succeeded", "verified"].includes(existing?.status)) {
    await admin.from("action_proposals").update({ status: "completed" }).eq("id", proposalId);
    return {
      ok: true,
      status: "completed",
      proposal_id: proposalId,
      execution_id: existing.id,
      already_done: true,
      result: existing.sanitized_result,
    };
  }

  await admin.from("action_proposals").update({ status: "executing" }).eq("id", proposalId);
  let executionId = existing?.id;
  if (!executionId) {
    const inserted = await admin.from("action_executions").insert({
      proposal_id: proposalId,
      organization_id: orgId,
      tool_name: tool,
      sanitized_arguments: args,
      idempotency_key: key,
      status: "running",
      started_at: new Date().toISOString(),
    }).select("id").single();
    if (inserted.error) return { ok: false, error: "execution_create_failed", detail: inserted.error.message, status: 500 };
    executionId = inserted.data.id;
  } else {
    await admin.from("action_executions").update({
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_code: null,
      error_message_sanitized: null,
    }).eq("id", executionId);
  }

  try {
    const result = await executeTool(admin, selection, orgId, userId, tool, args);
    const partial = Boolean((result as any).partial_failure);
    await admin.from("action_executions").update({
      status: partial ? "unverified" : "verified",
      sanitized_result: result,
      completed_at: new Date().toISOString(),
      verification_status: partial ? "partial" : "verified",
      rollback_reference: (result as any).rollback_reference ?? null,
    }).eq("id", executionId);
    await admin.from("action_proposals").update({
      status: partial ? "partially_completed" : "completed",
    }).eq("id", proposalId);
    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: userId,
      agent_id: "meta-execute",
      event_type: partial ? "meta.write.partial" : "meta.write.verified",
      entity_type: tool.replace("meta.", ""),
      entity_id: (result as any).object_id ?? null,
      action: tool,
      sanitized_metadata: { proposal_id: proposalId, execution_id: executionId, result },
    });
    return {
      ok: true,
      status: partial ? "partially_completed" : "completed",
      proposal_id: proposalId,
      execution_id: executionId,
      object_id: (result as any).object_id,
      tool_name: tool,
      result,
    };
  } catch (error) {
    const detail = text(error instanceof Error ? error.message : error, 300);
    await admin.from("action_executions").update({
      status: "failed",
      error_code: detail.split(":")[0],
      error_message_sanitized: detail,
      completed_at: new Date().toISOString(),
      verification_status: "failed",
    }).eq("id", executionId);
    await admin.from("action_proposals").update({ status: "failed" }).eq("id", proposalId);
    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: userId,
      agent_id: "meta-execute",
      event_type: "meta.write.failed",
      entity_type: tool.replace("meta.", ""),
      action: tool,
      sanitized_metadata: { proposal_id: proposalId, execution_id: executionId, error: detail },
    });
    return { ok: false, error: "meta_write_failed", detail, status: 502 };
  }
}
