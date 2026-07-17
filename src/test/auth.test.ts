import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  isStrongPassword,
  isValidUsername,
  normalizeUsername,
  passwordRequirements,
} from "@/lib/auth";
import { MetaApiError } from "@/hooks/useMetaData";

describe("autenticação por usuário", () => {
  it("normaliza e valida aliases sem aceitar formatos ambíguos", () => {
    expect(normalizeUsername("  Emanuele ")).toBe("emanuele");
    expect(isValidUsername("emanuele")).toBe(true);
    expect(isValidUsername("em")).toBe(false);
    expect(isValidUsername("emanuele@email")).toBe(false);
  });

  it("exige senha forte", () => {
    expect(isStrongPassword("SenhaForte@123")).toBe(true);
    expect(isStrongPassword("senha-fraca")).toBe(false);
    expect(passwordRequirements("Aa1!aaaa").special).toBe(true);
  });

  it("não revela se usuário ou e-mail existe", () => {
    expect(friendlyAuthError(new Error("invalid_credentials"))).toBe(
      "Usuário/e-mail ou senha inválidos.",
    );
  });
});

describe("erros tipados da Meta", () => {
  it("preserva código, status e request id do backend", () => {
    const error = new MetaApiError({
      code: "campaign_not_in_selected_account",
      message: "Campanha indisponível",
      status: 404,
      requestId: "req-123",
    });
    expect(error.message).toBe("Campanha indisponível");
    expect(error.status).toBe(404);
    expect(error.requestId).toBe("req-123");
  });
});
