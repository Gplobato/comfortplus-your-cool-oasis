// Meta OAuth callback (no user JWT — state HMAC is the trust anchor).
// Validates state, exchanges code for a long-lived token, encrypts it, persists
// the connection + discovered businesses/ad accounts, redirects to app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptSecret, verifyState } from "../_shared/meta-crypto.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirect(origin: string, params: Record<string, string>) {
  const u = new URL("/integracoes", origin);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return Response.redirect(u.toString(), 302);
}

async function fetchJson(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) {
    const msg = j?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Public username/password bridge. This lives on the already-deployed callback
  // function so Lovable projects that do not auto-create new function names can
  // still support username aliases. OAuth callback behavior remains GET-only.
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "password_login") return json({ error: "unknown_action" }, 400);
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!identifier || !password) return json({ error: "invalid_credentials" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "auth_not_configured" }, 500);

    let email = identifier;
    if (!identifier.includes("@")) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("username", identifier)
        .maybeSingle();
      email = String(profile?.email ?? "");
    }
    if (!email) return json({ error: "invalid_credentials" }, 400);

    const auth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return json({ error: "invalid_credentials" }, 400);
    }
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
    });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrDesc = url.searchParams.get("error_description");

  // We need the state first to know where to redirect back to.
  let state;
  try {
    if (!stateParam) throw new Error("missing state");
    state = await verifyState(stateParam);
  } catch (_e) {
    return new Response("Invalid or expired OAuth state.", { status: 400 });
  }

  if (oauthError || !code) {
    return redirect(state.return_origin, {
      meta: "error",
      reason: oauthError ?? "no_code",
      detail: (oauthErrDesc ?? "").slice(0, 120),
    });
  }

  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!appId || !appSecret) {
    return redirect(state.return_origin, { meta: "error", reason: "app_not_configured" });
  }

  const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // 1. Exchange code -> short-lived token
    const short = await fetchJson(
      `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&code=${encodeURIComponent(code)}`,
    );

    // 2. Upgrade to long-lived token (~60d)
    const long = await fetchJson(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(short.access_token)}`,
    );
    const accessToken: string = long.access_token;
    const expiresIn: number | undefined = long.expires_in;

    // 3. Identify user + granted scopes
    const me = await fetchJson(
      `${GRAPH}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
    const perms = await fetchJson(
      `${GRAPH}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,
    );
    const grantedScopes: string[] = (perms.data ?? [])
      .filter((p: any) => p.status === "granted")
      .map((p: any) => p.permission);

    // 4. Encrypt token + upsert connection (one active per org)
    const encToken = await encryptSecret(accessToken);
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Revoke any previous active connection for this org
    await admin
      .from("meta_connections")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("organization_id", state.org_id)
      .eq("status", "active");

    const { data: conn, error: connErr } = await admin
      .from("meta_connections")
      .insert({
        organization_id: state.org_id,
        connected_by_user_id: state.user_id,
        provider: "meta",
        external_user_id: me.id,
        display_name: me.name ?? me.email ?? "Meta user",
        status: "active",
        granted_scopes: grantedScopes,
        encrypted_access_token: encToken,
        token_expires_at: tokenExpiresAt,
        last_success_at: new Date().toISOString(),
        last_health_check_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (connErr || !conn) throw new Error(connErr?.message ?? "connection_insert_failed");

    // 5. Discover businesses + ad accounts (read-only)
    const assets: any[] = [];
    try {
      const bizs = await fetchJson(
        `${GRAPH}/me/businesses?fields=id,name&limit=100&access_token=${encodeURIComponent(accessToken)}`,
      );
      for (const b of bizs.data ?? []) {
        assets.push({
          organization_id: state.org_id,
          connection_id: conn.id,
          asset_type: "business",
          external_id: b.id,
          name: b.name,
          metadata_sanitized: {},
          last_synced_at: new Date().toISOString(),
        });
      }
    } catch (_e) { /* business_management may not be granted */ }

    try {
      const accts = await fetchJson(
        `${GRAPH}/me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status` +
          `&limit=200&access_token=${encodeURIComponent(accessToken)}`,
      );
      for (const a of accts.data ?? []) {
        assets.push({
          organization_id: state.org_id,
          connection_id: conn.id,
          asset_type: "ad_account",
          external_id: a.id, // e.g. act_123
          name: a.name,
          currency: a.currency ?? null,
          timezone: a.timezone_name ?? null,
          status: String(a.account_status ?? ""),
          metadata_sanitized: { account_id: a.account_id },
          last_synced_at: new Date().toISOString(),
        });
      }
    } catch (_e) { /* ads_read may be restricted for this user */ }

    if (assets.length) {
      await admin.from("meta_assets").insert(assets);
    }

    await admin.from("audit_logs").insert({
      organization_id: state.org_id,
      user_id: state.user_id,
      event_type: "meta.connected",
      entity_type: "meta_connection",
      entity_id: conn.id,
      sanitized_metadata: {
        scopes: grantedScopes,
        ad_accounts: assets.filter((a) => a.asset_type === "ad_account").length,
        businesses: assets.filter((a) => a.asset_type === "business").length,
      },
    });

    return redirect(state.return_origin, { meta: "connected" });
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 200);
    await admin.from("audit_logs").insert({
      organization_id: state.org_id,
      user_id: state.user_id,
      event_type: "meta.connect_failed",
      sanitized_metadata: { error: msg },
    });
    return redirect(state.return_origin, { meta: "error", reason: "exchange_failed", detail: msg });
  }
});

// lovable-redeploy: 2026-07-17T17:09:51.1203059Z
