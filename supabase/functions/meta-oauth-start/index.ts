// Starts the Meta OAuth flow. Requires authenticated user + org membership.
// Returns { authUrl } that the frontend opens in a new tab / same tab.
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { isAllowedOrigin, signState } from "../_shared/meta-crypto.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v20.0";
// ads_management enables gradual write (pause ad/adset/campaign) after human approval.
const SCOPES = [
  "public_profile",
  "email",
  "ads_read",
  "ads_management",
  "business_management",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const appId = Deno.env.get("META_APP_ID");
  if (!appId) return json({ error: "meta_app_not_configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const orgId = String(body.organization_id ?? "");
  const returnOrigin = String(body.return_origin ?? "");
  if (!orgId) return json({ error: "organization_id_required" }, 400);
  if (!isAllowedOrigin(returnOrigin)) return json({ error: "invalid_return_origin" }, 400);

  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

  const nonce = crypto.randomUUID();
  const state = await signState({
    org_id: orgId,
    user_id: ctx.userId,
    return_origin: returnOrigin,
    nonce,
    ts: Math.floor(Date.now() / 1000),
  });

  const configId = Deno.env.get("META_LOGIN_CONFIG_ID");
  const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  if (configId) {
    // Facebook Login for Business: config_id defines the permissions/assets set.
    authUrl.searchParams.set("config_id", configId);
  } else {
    // Classic Facebook Login fallback.
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("auth_type", "rerequest");
  }

  return json({ authUrl: authUrl.toString(), redirect_uri: redirectUri });
});
