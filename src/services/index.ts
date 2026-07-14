import {
  adAccounts,
  approvals,
  audiences,
  auditLogs,
  campaigns,
  company,
  conversations,
  creatives,
  currentUser,
  generateMetricSeries,
  integrations,
  notifications,
  recommendations,
} from "@/mocks/data";
import type {
  AgentMessage,
  Approval,
  Campaign,
  Creative,
  Integration,
} from "@/types/proads";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((r) => setTimeout(() => r(structuredClone(data)), ms));

// Campaign
export const campaignService = {
  list: () => delay(campaigns),
  get: (id: string) => delay(campaigns.find((c) => c.id === id)),
  pause: (id: string) => delay({ id, status: "PAUSED" as const }),
  activate: (id: string) => delay({ id, status: "REVIEW" as const }),
  archive: (id: string) => delay({ id, status: "ARCHIVED" as const }),
  create: (input: Partial<Campaign>) =>
    delay({
      ...input,
      id: `cmp_${Date.now()}`,
      status: "PAUSED" as const,
      approvalStatus: "pending" as const,
    }),
};

// Creative
export const creativeService = {
  list: () => delay(creatives),
  get: (id: string) => delay(creatives.find((c) => c.id === id)),
  generate: (input: { prompt: string; type: string }) =>
    delay({ id: `cr_${Date.now()}`, ...input, status: "pending" as const }, 800),
  create: (input: Partial<Creative>) => delay({ ...input, id: `cr_${Date.now()}` }),
};

// Approvals
export const approvalService = {
  list: () => delay(approvals),
  approve: (id: string, note?: string) => delay({ id, status: "approved" as const, note }),
  reject: (id: string, note?: string) => delay({ id, status: "rejected" as const, note }),
};

// Audiences
export const audienceService = {
  list: () => delay(audiences),
  get: (id: string) => delay(audiences.find((a) => a.id === id)),
};

// Integrations
export const integrationService = {
  list: () => delay(integrations),
  connect: (id: string) => delay({ id, status: "connected" as const }, 900),
  disconnect: (id: string) => delay({ id, status: "disconnected" as const }),
};

// Analytics
export const analyticsService = {
  overview: () => delay(generateMetricSeries(14)),
  byPlatform: () =>
    delay([
      { platform: "Meta", leads: 785, spend: 10481, cpl: 13.35 },
      { platform: "Google", leads: 298, spend: 3928, cpl: 13.18 },
      { platform: "TikTok", leads: 167, spend: 3152, cpl: 18.88 },
    ]),
};

// Audit
export const auditService = {
  list: () => delay(auditLogs),
};

// Agent
export const aiAgentService = {
  conversations: () => delay(conversations),
  send: (input: { conversationId: string; content: string }): Promise<AgentMessage> =>
    new Promise((res) =>
      setTimeout(
        () =>
          res({
            id: `msg_${Date.now()}`,
            role: "assistant",
            content:
              "Analisei suas campanhas ativas. Encontrei **3 oportunidades**:\n\n1. Aumentar orçamento em Remarketing ProMonitor (+24% leads estimados).\n2. Pausar criativo com fadiga em Segurança com IA.\n3. Testar novo público lookalike 2%.\n\nQuer que eu prepare essas ações como rascunho para aprovação?",
            agent: "director",
            createdAt: new Date().toISOString(),
            toolsUsed: [
              { id: "t1", tool: "campaign.metrics", status: "completed" },
              { id: "t2", tool: "audience.overlap", status: "completed" },
            ],
            actions: [
              { label: "Preparar rascunhos", kind: "primary" },
              { label: "Ver análise completa", kind: "secondary" },
              { label: "Cancelar", kind: "ghost" },
            ],
            status: "sent",
          }),
        900,
      ),
    ),
};

// Account/company
export const accountService = {
  currentUser: () => delay(currentUser),
  company: () => delay(company),
  adAccounts: () => delay(adAccounts),
  notifications: () => delay(notifications),
  recommendations: () => delay(recommendations),
};
