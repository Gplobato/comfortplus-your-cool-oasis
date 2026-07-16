// Meta ad account ID normalization + active-selection resolver.
// `meta_assets.external_id` for ad accounts is stored WITH the `act_` prefix
// (see meta-oauth-callback). Consumers must not concatenate `act_${id}` by hand;
// always use these helpers.

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret } from "./meta-crypto.ts";

export function normalizeMetaAdAccountId(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).replace(/^act_/, "");
}

export function toGraphAdAccountId(v: string | null | undefined): string {
  const n = normalizeMetaAdAccountId(v);
  return n ? `act_${n}` : "";
}

export type ActiveSelection = {
  connection: {
    id: string;
    display_name: string | null;
    status: string;
    granted_scopes: string[] | null;
    token_expires_at: string | null;
    last_success_at: string | null;
    last_sync_at: string | null;
  };
  account: {
    id: string;
    external_id: string; // as stored (with act_)
    account_id: string; // normalized (no act_)
    graph_id: string; // with act_
    name: string;
    currency: string | null;
    timezone: string | null;
  };
  token: string;
};

export type ActiveSelectionError =
  | { kind: "no_connection" }
  | { kind: "no_account" }
  | { kind: "token_error"; message: string };

export async function loadActiveSelection(
  admin: SupabaseClient,
  orgId: string,
): Promise<ActiveSelection | ActiveSelectionError> {
  const { data: conn } = await admin
    .from("meta_connections")
    .select(
      "id, display_name, status, granted_scopes, token_expires_at, last_success_at, last_sync_at, encrypted_access_token",
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conn) return { kind: "no_connection" };

  const { data: acct } = await admin
    .from("meta_assets")
    .select("id, external_id, name, currency, timezone")
    .eq("connection_id", conn.id)
    .eq("asset_type", "ad_account")
    .eq("selected", true)
    .maybeSingle();
  if (!acct) return { kind: "no_account" };

  let token: string;
  try {
    token = await decryptSecret(conn.encrypted_access_token as string);
  } catch (e: any) {
    return { kind: "token_error", message: String(e?.message ?? e).slice(0, 200) };
  }

  return {
    connection: {
      id: conn.id,
      display_name: conn.display_name,
      status: conn.status,
      granted_scopes: conn.granted_scopes,
      token_expires_at: conn.token_expires_at,
      last_success_at: conn.last_success_at,
      last_sync_at: (conn as any).last_sync_at ?? null,
    },
    account: {
      id: acct.id,
      external_id: acct.external_id,
      account_id: normalizeMetaAdAccountId(acct.external_id),
      graph_id: toGraphAdAccountId(acct.external_id),
      name: acct.name ?? acct.external_id,
      currency: acct.currency,
      timezone: acct.timezone,
    },
    token,
  };
}

export function sanitizeMetaError(e: any): string {
  const msg = e?.error?.message ?? e?.message ?? String(e);
  return String(msg).slice(0, 200);
}
