import type { AgentMessage } from "@/types/proads";

const STORAGE_KEY = "proads:agent-threads:v1";
const CURRENT_KEY = "proads:agent-current:v1";

export interface AgentThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: AgentMessage[];
}

const INITIAL_MESSAGE: AgentMessage = {
  id: "welcome",
  role: "assistant",
  agent: "director",
  content:
    "Olá, Gabriel! 👋\n\nSou o Assistente ProAds — posso conversar, pesquisar concorrentes, planejar campanhas e gerar criativos em imagem. É só pedir.",
  createdAt: new Date().toISOString(),
  status: "sent",
};

export function createThread(title = "Nova conversa"): AgentThread {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    updatedAt: new Date().toISOString(),
    messages: [INITIAL_MESSAGE],
  };
}

export function loadThreads(): AgentThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: AgentThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function loadCurrentId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CURRENT_KEY);
}

export function saveCurrentId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURRENT_KEY, id);
}
