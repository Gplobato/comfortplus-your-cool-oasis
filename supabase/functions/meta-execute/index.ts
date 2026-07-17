// Thin wrapper — prefer meta-connection?action=execute_proposal (already deployed by Lovable).
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { executeApprovedProposal } from "../_shared/meta-execute-core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = String(body.organization_id ?? "");
    const proposalId = String(body.proposal_id ?? "");
    if (!orgId || !proposalId) return json({ error: "organization_id_and_proposal_id_required" }, 400);

    const gate = await requireOrgMember(ctx, orgId);
    if (gate !== true) return gate;

    const result = await executeApprovedProposal(ctx.adminClient, {
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
  } catch (e: any) {
    console.error("meta-execute", e);
    return json({ error: "internal", detail: String(e?.message ?? e).slice(0, 200) }, 500);
  }
});
