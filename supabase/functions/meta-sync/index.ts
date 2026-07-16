// Meta integration sync: refresh discovered assets + touch last_sync_at.
// POST { organization_id }
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function gfetch(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => ({}));
  const orgId = String(body.organization_id ?? "");
  if (!orgId) return json({ error: "organization_id_required" }, 400);
  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const sel = await loadActiveSelection(ctx.adminClient, orgId);
  if ("kind" in sel) return json({ error: sel.kind, message: (sel as any).message }, 409);

  const admin = ctx.adminClient;
  const token = encodeURIComponent(sel.token);
  const warnings: string[] = [];

  // Re-discover ad accounts, preserving `selected` for the current account
  const selectedAssetId = sel.account.id;
  try {
    const accts = await gfetch(
      `${GRAPH}/me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status&limit=200&access_token=${token}`,
    );
    // Load existing to preserve `selected` and diff
    const { data: existing } = await admin
      .from("meta_assets")
      .select("id, external_id, selected")
      .eq("connection_id", sel.connection.id)
      .eq("asset_type", "ad_account");
    const bySelected = new Set(
      (existing ?? []).filter((e) => e.selected).map((e) => e.external_id),
    );
    for (const a of accts.data ?? []) {
      const payload = {
        organization_id: orgId,
        connection_id: sel.connection.id,
        asset_type: "ad_account",
        external_id: a.id,
        name: a.name,
        currency: a.currency ?? null,
        timezone: a.timezone_name ?? null,
        status: String(a.account_status ?? ""),
        metadata_sanitized: { account_id: a.account_id },
        last_synced_at: new Date().toISOString(),
        selected: bySelected.has(a.id),
      };
      await admin
        .from("meta_assets")
        .upsert(payload, { onConflict: "connection_id,asset_type,external_id" });
    }
  } catch (e) {
    warnings.push(`adaccounts: ${sanitizeMetaError(e)}`);
  }

  // Sanity-check selection still exists
  const { data: still } = await admin
    .from("meta_assets")
    .select("id")
    .eq("id", selectedAssetId)
    .maybeSingle();
  if (!still) warnings.push("selected_account_missing_after_sync");

  const now = new Date().toISOString();
  await admin
    .from("meta_connections")
    .update({ last_sync_at: now, last_success_at: now })
    .eq("id", sel.connection.id);

  await admin.from("audit_logs").insert({
    organization_id: orgId,
    user_id: ctx.userId,
    event_type: "meta.synced",
    entity_type: "meta_connection",
    entity_id: sel.connection.id,
    sanitized_metadata: { account_id: sel.account.account_id, warnings },
  });

  return json({
    success: true,
    account_id: sel.account.account_id,
    synced_at: now,
    source: "marketing_api",
    warnings,
  });
});
