import type { MoneyLeftInsight } from "@/lib/trafficChat";

export type TmChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  sources?: { title: string; url: string }[];
  proposals?: { id: string; title: string }[];
  moneyLeft?: MoneyLeftInsight | null;
};

export type TmThread = {
  id: string;
  title: string;
  updatedAt: string;
  campaignExternalId: string | null;
  campaignName: string | null;
  messages: TmChatMsg[];
};

const STORAGE_PREFIX = "proads:tm-threads:v1:";
const CURRENT_PREFIX = "proads:tm-current:v1:";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}
function currentKey(orgId: string) {
  return `${CURRENT_PREFIX}${orgId}`;
}

export function welcomeMessage(campaignName?: string | null): TmChatMsg {
  return {
    id: `welcome_${Date.now()}`,
    role: "assistant",
    content: campaignName
      ? `Nova conversa sobre **${campaignName}**. Posso analisar reativação, dinheiro na mesa, fadiga de criativo e propostas.`
      : "Nova conversa com o **Gerente de Tráfego**. Pergunte sobre campanhas ativas **e pausadas**, o que reativar, e quanto está na mesa.",
    at: new Date().toISOString(),
  };
}

export function createTmThread(opts?: {
  title?: string;
  campaignExternalId?: string | null;
  campaignName?: string | null;
}): TmThread {
  const campaignName = opts?.campaignName ?? null;
  return {
    id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: opts?.title || (campaignName ? `Análise · ${campaignName.slice(0, 40)}` : "Nova conversa"),
    updatedAt: new Date().toISOString(),
    campaignExternalId: opts?.campaignExternalId ?? null,
    campaignName,
    messages: [welcomeMessage(campaignName)],
  };
}

export function loadTmThreads(orgId: string): TmThread[] {
  if (typeof window === "undefined" || !orgId) return [];
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTmThreads(orgId: string, threads: TmThread[]) {
  if (typeof window === "undefined" || !orgId) return;
  localStorage.setItem(storageKey(orgId), JSON.stringify(threads));
}

export function loadTmCurrentId(orgId: string): string | null {
  if (typeof window === "undefined" || !orgId) return null;
  return localStorage.getItem(currentKey(orgId));
}

export function saveTmCurrentId(orgId: string, id: string) {
  if (typeof window === "undefined" || !orgId) return;
  localStorage.setItem(currentKey(orgId), id);
}

export function titleFromFirstUserMessage(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "Nova conversa";
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}
