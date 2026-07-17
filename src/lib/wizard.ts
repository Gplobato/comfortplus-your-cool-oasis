export type WizardObjective = "leads" | "sales" | "whatsapp" | "awareness";
export type WizardStyle = "premium" | "direct" | "ugc" | "minimal";
export type WizardFormat = "feed" | "story";

export type WizardAnswers = {
  businessName: string;
  niche: string;
  offer: string;
  differentiator: string;
  audience: string;
  pain: string;
  objective: WizardObjective;
  style: WizardStyle;
  format: WizardFormat;
};

export type WizardPreview = {
  image_url: string;
  headline: string;
  primary_text: string;
  cta: string;
};

export type WizardSession = {
  version: 1;
  answers: WizardAnswers;
  preview: WizardPreview | null;
  completedAt: string | null;
};

export const EMPTY_WIZARD_ANSWERS: WizardAnswers = {
  businessName: "",
  niche: "",
  offer: "",
  differentiator: "",
  audience: "",
  pain: "",
  objective: "leads",
  style: "direct",
  format: "feed",
};

const SESSION_KEY = "proads:wizard:v1";
const DEVICE_KEY = "proads:wizard:device";

export function loadWizardSession(): WizardSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as WizardSession | null;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWizardSession(session: WizardSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getWizardDeviceId() {
  const current = localStorage.getItem(DEVICE_KEY);
  if (current) return current;
  const value = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, value);
  return value;
}

function endpoint() {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wizard-preview`;
}

function publicHeaders() {
  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload.error ?? `http_${response.status}`));
    Object.assign(error, { status: response.status, detail: payload.detail });
    throw error;
  }
  return payload;
}

export async function generateWizardPreview(answers: WizardAnswers) {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify({
      action: "generate",
      device_id: getWizardDeviceId(),
      answers,
    }),
    signal: AbortSignal.timeout(145_000),
  });
  const payload = await parseResponse(response);
  return payload.preview as WizardPreview;
}

export async function joinWizardWaitlist(input: {
  name: string;
  email: string;
  whatsapp: string;
  intent: "pricing" | "video";
  answers: WizardAnswers;
}) {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify({ action: "waitlist", ...input }),
    signal: AbortSignal.timeout(15_000),
  });
  await parseResponse(response);
}

export function wizardErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error ?? "");
  if (code === "preview_already_used") return "A prévia gratuita deste dispositivo já foi utilizada.";
  if (code === "ip_preview_limit") return "O limite de prévias gratuitas desta rede foi atingido hoje.";
  if (code === "generation_in_progress") return "Sua prévia ainda está sendo gerada. Aguarde alguns instantes.";
  if (code === "wizard_not_configured" || code === "generation_not_configured") {
    return "A geração está em configuração. Entre na lista para ser avisado.";
  }
  if (code === "TimeoutError") return "A geração demorou além do esperado. Tente novamente.";
  return "Não foi possível gerar sua prévia agora. Tente novamente em instantes.";
}
