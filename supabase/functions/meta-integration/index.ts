// Unified Meta integration status for an organization.
// GET ?organization_id=...
// Returns the canonical shape consumed by the frontend MetaIntegrationContext.
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { normalizeMetaAdAccountId } from "../_shared/meta-ids.ts";

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

  const admin = ctx.adminClient;

  const { data: conn } = await admin
    .from("meta_connections")
    .select(
      "id, display_name, external_user_id, status, granted_scopes, token_expires_at, last_success_at, last_health_check_at, last_sync_at, last_error_code, last_error_message_sanitized, created_at",
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) {
    return json({
      enabled: true,
      connected: false,
      connection_status: "disconnected",
      connection_id: null,
      connected_user: null,
      selected_ad_account: null,
      available_ad_accounts: [],
      available_ad_accounts_count: 0,
      last_sync_at: null,
      data_source: null,
      token_status: null,
      last_error: null,
      requires_account_selection: false,
    });
  }

  const { data: assets } = await admin
    .from("meta_assets")
    .select("id, asset_type, external_id, name, currency, timezone, status, selected")
    .eq("connection_id", conn.id)
    .order("asset_type")
    .order("name");

  const adAccounts = (assets ?? [])
    .filter((a) => a.asset_type === "ad_account")
    .map((a) => ({
      id: a.id,
      external_id: a.external_id,
      account_id: normalizeMetaAdAccountId(a.external_id),
      name: a.name ?? a.external_id,
      currency: a.currency,
      timezone: a.timezone,
      status: a.status,
      selected: a.selected,
    }));

  const selected = adAccounts.find((a) => a.selected) ?? null;

  // Derive connection status label
  let connection_status:
    | "disconnected" | "connecting" | "connected" | "expired" | "degraded" | "error" = "connected";
  if (conn.status === "degraded") connection_status = "degraded";
  else if (conn.status === "reauth_required" || conn.status === "revoked") connection_status = "expired";
  else if (conn.status === "error") connection_status = "error";

  let token_status: "valid" | "expiring" | "expired" | "unknown" = "valid";
  if (conn.token_expires_at) {
    const exp = new Date(conn.token_expires_at).getTime();
    const now = Date.now();
    if (exp < now) token_status = "expired";
    else if (exp - now < 7 * 24 * 3600 * 1000) token_status = "expiring";
  } else {
    token_status = "unknown";
  }

  return json({
    enabled: true,
    connected: connection_status === "connected" || connection_status === "degraded",
    connection_status,
    connection_id: conn.id,
    connected_user: {
      id: conn.external_user_id,
      name: conn.display_name,
    },
    selected_ad_account: selected,
    available_ad_accounts: adAccounts,
    available_ad_accounts_count: adAccounts.length,
    last_sync_at: (conn as any).last_sync_at ?? conn.last_success_at ?? null,
    data_source: "marketing_api",
    token_status,
    last_error: conn.last_error_message_sanitized,
    requires_account_selection: !selected,
  });
});
