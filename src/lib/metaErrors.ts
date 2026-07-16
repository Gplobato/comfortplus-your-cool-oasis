// Maps backend/Meta errors to user-facing PT-BR messages.
// Never expose raw Graph API payloads, tokens, HTML, or stack traces.

export type MetaFriendlyError = {
  title: string;
  description: string;
  kind:
    | "token_expired"
    | "no_account_selected"
    | "no_permission"
    | "no_activity"
    | "rate_limit"
    | "temporary"
    | "unknown";
};

const MAP: Array<{ match: RegExp; err: MetaFriendlyError }> = [
  {
    match: /token[_ ]?expired|oauth.*expired|invalid[_ ]oauth|reautenticad|reconecte/i,
    err: {
      kind: "token_expired",
      title: "Conexão com a Meta expirou",
      description: "Sua conexão com a Meta expirou. Reconecte a conta em Integrações.",
    },
  },
  {
    match: /no_account_selected|account_not_selected|no ad account/i,
    err: {
      kind: "no_account_selected",
      title: "Nenhuma conta selecionada",
      description: "Selecione uma conta de anúncio para visualizar os dados.",
    },
  },
  {
    match: /permission|forbidden|not authorized|insufficient/i,
    err: {
      kind: "no_permission",
      title: "Sem permissão na conta",
      description:
        "A conta foi conectada, mas não possui permissão para consultar estes dados.",
    },
  },
  {
    match: /no data|sem atividade|no_activity/i,
    err: {
      kind: "no_activity",
      title: "Sem atividade",
      description: "Não encontramos atividade para o período selecionado.",
    },
  },
  {
    match: /rate.?limit|too many requests|429|throttle/i,
    err: {
      kind: "rate_limit",
      title: "Meta limitou as consultas",
      description:
        "A Meta limitou temporariamente as consultas. Tente novamente em alguns minutos.",
    },
  },
  {
    match: /NOT_FOUND|function was not found|http_404/i,
    err: {
      kind: "temporary",
      title: "Função ainda não publicada",
      description:
        "A API de criativos ainda não está no ar neste ambiente. Aguarde o deploy ou atualize a página em instantes.",
    },
  },
];

export function metaErrorMessage(input: unknown): MetaFriendlyError {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : (input as any)?.error ?? (input as any)?.message ?? "";
  const text = String(raw ?? "");
  for (const { match, err } of MAP) if (match.test(text)) return err;
  return {
    kind: "temporary",
    title: "Erro temporário",
    description: "Não foi possível atualizar os dados da Meta. Tente novamente em instantes.",
  };
}
