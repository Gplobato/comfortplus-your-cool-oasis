import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber } from "@/lib/format";
import { normalizeMetaSummary } from "@/hooks/useMetaData";
import {
  extractCostPerLead,
  extractResults,
} from "../../supabase/functions/_shared/meta-normalize";
import {
  actionPolicyDecision,
  assertBudgetWithinPolicy,
  CONSERVATIVE_META_POLICY,
} from "../../supabase/functions/_shared/meta-policy";

describe("formatação segura de métricas", () => {
  it("não renderiza NaN ou Infinity", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("preserva zero como dado disponível", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatCurrency(0)).toContain("0,00");
  });

  it("normaliza contratos antigos da Edge Function", () => {
    const summary = normalizeMetaSummary({ spend: 10 } as never);
    expect(summary.spend).toBe(10);
    expect(summary.results).toBe(0);
    expect(summary.cpl).toBeNull();
    expect(summary.result_type).toBe("unknown");
  });
});

describe("semântica Meta", () => {
  it("usa inline link clicks como fallback para tráfego", () => {
    expect(extractResults([], "OUTCOME_TRAFFIC", { linkClicks: 12 })).toEqual({
      results: 12,
      result_type: "link_click",
    });
  });

  it("só calcula CPL quando existem leads", () => {
    expect(extractCostPerLead([], 100, 0)).toBeNull();
    expect(extractCostPerLead([], 100, 4)).toBe(25);
  });
});

describe("política conservadora do executor", () => {
  it("executa pausa e rascunho pausado diretamente", () => {
    expect(actionPolicyDecision("meta.pause_campaign", CONSERVATIVE_META_POLICY).requiresApproval).toBe(false);
    expect(actionPolicyDecision("meta.create_campaign_structure", CONSERVATIVE_META_POLICY).requiresApproval).toBe(false);
  });

  it("exige aprovação para ativação e orçamento", () => {
    expect(actionPolicyDecision("meta.activate_campaign", CONSERVATIVE_META_POLICY).requiresApproval).toBe(true);
    expect(actionPolicyDecision("meta.update_adset_budget", CONSERVATIVE_META_POLICY).requiresApproval).toBe(true);
  });

  it("bloqueia orçamento inválido e variação acima do limite", () => {
    expect(assertBudgetWithinPolicy(CONSERVATIVE_META_POLICY, 0).ok).toBe(false);
    expect(assertBudgetWithinPolicy(CONSERVATIVE_META_POLICY, 130, 100).ok).toBe(false);
    expect(assertBudgetWithinPolicy(CONSERVATIVE_META_POLICY, 115, 100).ok).toBe(true);
  });
});
