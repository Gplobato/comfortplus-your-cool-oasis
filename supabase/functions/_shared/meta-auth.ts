// Shared: JWT validation + org membership check for Meta endpoints.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AuthContext = {
  userId: string;
  userClient: SupabaseClient; // acts as the user (RLS applies)
  adminClient: SupabaseClient; // service-role, bypasses RLS (backend-only writes)
};

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) return json({ error: "unauthorized" }, 401);

  const adminClient = createClient(url, service, { auth: { persistSession: false } });
  return { userId: data.claims.sub, userClient, adminClient };
}

export async function requireOrgMember(
  ctx: AuthContext,
  orgId: string,
): Promise<true | Response> {
  const { data, error } = await ctx.adminClient
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) return json({ error: "membership_check_failed" }, 500);
  if (!data) return json({ error: "forbidden" }, 403);
  return true;
}
