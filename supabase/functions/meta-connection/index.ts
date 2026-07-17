// Read/manage the Meta connection for an org. Never returns tokens.
// Actions:
//   GET  ?action=status&organization_id=...
//   POST { action: "test", organization_id }
//   POST { action: "select_account", organization_id, asset_id }
//   POST { action: "disconnect", organization_id }
//   POST { action: "submit_action", organization_id, tool_name, arguments }
//   POST { action: "execute_proposal", organization_id, proposal_id }
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { decryptSecret } from "../_shared/meta-crypto.ts";
import { executeApprovedProposal, submitMetaAction } from "../_shared/meta-execute-core.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function loadStatus(admin: any, orgId: string) {
  const { data: conn } = await admin
    .from("meta_connections")
    .select(
      "id, display_name, external_user_id, status, granted_scopes, token_expires_at, last_success_at, last_health_check_at, last_error_code, last_error_message_sanitized, created_at",
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) return { connected: false as const, connection: null, assets: [] };

  const { data: assets } = await admin
    .from("meta_assets")
    .select("id, asset_type, external_id, name, currency, timezone, status, selected, metadata_sanitized")
    .eq("connection_id", conn.id)
    .order("asset_type")
    .order("name");

  return { connected: true as const, connection: conn, assets: assets ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  let action: string;
  let orgId: string;
  let body: any = {};

  if (req.method === "GET") {
    action = url.searchParams.get("action") ?? "status";
    orgId = url.searchParams.get("organization_id") ?? "";
  } else if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
    action = String(body.action ?? "");
    orgId = String(body.organization_id ?? "");
  } else {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!orgId) return json({ error: "organization_id_required" }, 400);
  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const admin = ctx.adminClient;

  if (action === "status") {
    return json(await loadStatus(admin, orgId));
  }

  // All other actions need an active connection
  const { data: conn } = await admin
    .from("meta_connections")
    .select("id, encrypted_access_token")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conn) return json({ error: "no_active_connection" }, 404);

  if (action === "test") {
    try {
      const token = await decryptSecret(conn.encrypted_access_token);
      const r = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok || j.error) {
        const msg = String(j?.error?.message ?? `HTTP ${r.status}`).slice(0, 200);
        await admin
          .from("meta_connections")
          .update({
            status: "degraded",
            last_health_check_at: new Date().toISOString(),
            last_error_code: String(j?.error?.code ?? r.status),
            last_error_message_sanitized: msg,
          })
          .eq("id", conn.id);
        return json({ ok: false, error: msg }, 200);
      }
      await admin
        .from("meta_connections")
        .update({
          status: "active",
          last_health_check_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error_code: null,
          last_error_message_sanitized: null,
        })
        .eq("id", conn.id);
      return json({ ok: true, user: { id: j.id, name: j.name } });
    } catch (e: any) {
      return json({ ok: false, error: String(e?.message ?? e).slice(0, 200) }, 500);
    }
  }

  if (action === "select_account") {
    const assetId = String(body.asset_id ?? "");
    if (!assetId) return json({ error: "asset_id_required" }, 400);
    // Clear previous selection then set this one (scoped to connection)
    await admin
      .from("meta_assets")
      .update({ selected: false })
      .eq("connection_id", conn.id)
      .eq("asset_type", "ad_account");
    const { error } = await admin
      .from("meta_assets")
      .update({ selected: true })
      .eq("connection_id", conn.id)
      .eq("id", assetId);
    if (error) return json({ error: error.message }, 500);
    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: ctx.userId,
      event_type: "meta.ad_account_selected",
      entity_type: "meta_asset",
      entity_id: assetId,
    });
    return json({ ok: true });
  }

  if (action === "disconnect") {
    await admin
      .from("meta_connections")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        encrypted_access_token: null,
        encrypted_refresh_token: null,
      })
      .eq("id", conn.id);
    await admin.from("audit_logs").insert({
      organization_id: orgId,
      user_id: ctx.userId,
      event_type: "meta.disconnected",
      entity_type: "meta_connection",
      entity_id: conn.id,
    });
    return json({ ok: true });
  }

  if (action === "execute_proposal") {
    const proposalId = String(body.proposal_id ?? "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const result = await executeApprovedProposal(admin, {
      organizationId: orgId,
      proposalId,
      userId: ctx.userId,
    });
    if (!result.ok) {
      return json(
        { error: result.error, detail: result.detail, message: result.message },
        result.status ?? 400,
      );
    }
    return json(result);
  }

  if (action === "submit_action") {
    const toolName = String(body.tool_name ?? "");
    const args = body.arguments && typeof body.arguments === "object" ? body.arguments : {};
    if (!toolName) return json({ error: "tool_name_required" }, 400);
    const result = await submitMetaAction(admin, {
      organizationId: orgId,
      userId: ctx.userId,
      toolName,
      arguments: args,
      title: body.title ? String(body.title) : undefined,
      explanation: body.explanation ? String(body.explanation) : undefined,
      idempotencyKey: body.idempotency_key ? String(body.idempotency_key) : undefined,
    });
    if (!result.ok) {
      return json(
        { error: result.error, detail: result.detail, message: result.message },
        result.status ?? 400,
      );
    }
    return json(result);
  }

  return json({ error: "unknown_action" }, 400);
});
