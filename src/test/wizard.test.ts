import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_WIZARD_ANSWERS,
  getWizardDeviceId,
  loadWizardSession,
  saveWizardSession,
  wizardErrorMessage,
} from "@/lib/wizard";

describe("wizard público", () => {
  beforeEach(() => localStorage.clear());

  it("mantém um identificador estável por dispositivo", () => {
    const first = getWizardDeviceId();
    expect(first).toHaveLength(36);
    expect(getWizardDeviceId()).toBe(first);
  });

  it("salva e restaura o briefing sem dados sensíveis", () => {
    saveWizardSession({
      version: 1,
      answers: { ...EMPTY_WIZARD_ANSWERS, businessName: "ProAds" },
      preview: null,
      completedAt: null,
    });
    expect(loadWizardSession()?.answers.businessName).toBe("ProAds");
  });

  it("traduz limites públicos em mensagens claras", () => {
    expect(wizardErrorMessage(new Error("preview_already_used"))).toContain("já foi utilizada");
    expect(wizardErrorMessage(new Error("ip_preview_limit"))).toContain("rede");
  });
});
