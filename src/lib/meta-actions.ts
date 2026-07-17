import { supabase } from "@/integrations/supabase/client";

export type MetaActionResponse = {
  ok: true;
  status: "completed" | "partially_completed" | "awaiting_approval" | "approved" | "executing";
  proposal_id?: string;
  execution_id?: string;
  object_id?: string;
  message?: string;
  result?: Record<string, unknown>;
};

export async function submitMetaAction(input: {
  organizationId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  title: string;
  explanation?: string;
  idempotencyKey?: string;
}) {
  const { data, error } = await supabase.functions.invoke("meta-connection", {
    body: {
      action: "submit_action",
      organization_id: input.organizationId,
      tool_name: input.toolName,
      arguments: input.arguments,
      title: input.title,
      explanation: input.explanation,
      idempotency_key: input.idempotencyKey,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.message || data.error);
  return data as MetaActionResponse;
}

export async function executeMetaProposal(organizationId: string, proposalId: string) {
  const { data, error } = await supabase.functions.invoke("meta-connection", {
    body: {
      action: "execute_proposal",
      organization_id: organizationId,
      proposal_id: proposalId,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.message || data.error);
  return data as MetaActionResponse;
}

export function metaActionToastMessage(result: MetaActionResponse) {
  if (result.status === "awaiting_approval") return "Proposta enviada para Aprovações";
  if (result.status === "partially_completed") return "Ação parcialmente concluída; revise o histórico";
  return "Ação concluída e verificada na Meta";
}
