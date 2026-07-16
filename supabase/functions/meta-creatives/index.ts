// Thin wrapper — prefer meta-campaigns?resource=creatives until this function is deployed.
import { corsHeaders, json, requireOrgMember, requireUser } from "../_shared/meta-auth.ts";
import { loadActiveSelection, sanitizeMetaError } from "../_shared/meta-ids.ts";
import {
  buildCreativesPayload,
  buildLocalOnlyCreatives,
} from "../_shared/meta-creatives-core.ts";
import { newRequestId } from "../_shared/meta-normalize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const requestId = newRequestId();
  const started = Date.now();

  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("organization_id") ?? "";
  if (!orgId) return json({ error: "organization_id_required" }, 400);
  const gate = await requireOrgMember(ctx, orgId);
  if (gate !== true) return gate;

  const sel = await loadActiveSelection(ctx.adminClient, orgId);
  if ("kind" in sel) {
    const local = await buildLocalOnlyCreatives(ctx.adminClient, orgId, sel.kind, requestId);
    return json(local, 200);
  }

  try {
    const payload = await buildCreativesPayload({
      adminClient: ctx.adminClient,
      orgId,
      sel,
      searchParams: url.searchParams,
      requestId,
      started,
    });
    return json(payload);
  } catch (e) {
    return json({
      error: "creatives_fetch_failed",
      message: sanitizeMetaError(e),
      creatives: [],
      request_id: requestId,
    }, 502);
  }
});
