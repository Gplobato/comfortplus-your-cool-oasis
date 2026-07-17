import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Send, Loader2, Sparkles, Eraser, Search, Plus, Trash2, MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMetaAgentContext } from "@/hooks/useMetaAgentContext";
import { useMetaCampaigns, useMetaCampaignDetail, type MetaCampaignRow } from "@/hooks/useMetaData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { periodRange } from "@/lib/dates";
import { loadAiSettings } from "@/lib/aiSettings";
import {
  formatCurrency, formatMetaCurrency, formatMetaPercent, formatNumber, formatRoas,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CollapsibleChatBody } from "@/components/proads/CollapsibleChatBody";
import { extractMoneyLeft, type MoneyLeftInsight } from "@/lib/trafficChat";
import {
  createTmThread,
  loadTmCurrentId,
  loadTmThreads,
  saveTmCurrentId,
  saveTmThreads,
  titleFromFirstUserMessage,
  type TmChatMsg,
  type TmThread,
} from "@/lib/traffic-manager-storage";

const QUICK = [
  "Quanto estamos deixando de ganhar?",
  "Qual campanha pausada vale reativar?",
  "Qual campanha está queimando dinheiro?",
  "Compare as campanhas: onde está a oportunidade",
  "Pesquise o que concorrentes estão fazendo neste nicho",
];

function campaignBrief(c: MetaCampaignRow) {
  return {
    id: c.id,
    name: c.name,
    objective: c.objective,
    status: c.status,
    effective_status: c.effective_status,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    cpm: c.cpm,
    cpc: c.cpc,
    leads: c.leads,
    cpl: c.cpl,
    cpr: c.cpr,
    results: c.results,
    roas: c.roas,
    dailyBudget: c.dailyBudget,
    budgetLevel: c.budgetLevel,
  };
}

function isPaused(c: MetaCampaignRow) {
  return c.status === "PAUSED" || /PAUSED|CAMPAIGN_PAUSED/i.test(c.effective_status || "");
}
function isActive(c: MetaCampaignRow) {
  return c.status === "ACTIVE" || c.effective_status === "ACTIVE";
}

export function TrafficManagerChat({
  dateFrom,
  dateTo,
  compareCampaignIds,
  onConsumeCompare,
}: {
  dateFrom: string;
  dateTo: string;
  compareCampaignIds?: string[];
  onConsumeCompare?: () => void;
}) {
  const navigate = useNavigate();
  const { activeOrg } = useOrganization();
  const orgId = activeOrg?.id ?? "";
  const meta = useMetaIntegration();
  const metaCtx = useMetaAgentContext({ dateFrom, dateTo });
  // All statuses — paused campaigns must reach the Gerente
  const camps = useMetaCampaigns({ dateFrom, dateTo, status: "all" });
  const campaigns = camps.data?.campaigns ?? [];

  const [threads, setThreads] = useState<TmThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("account");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceSearch, setForceSearch] = useState(false);
  const [pendingCompareIds, setPendingCompareIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const monthRange = useMemo(() => periodRange(30), []);
  const detail = useMetaCampaignDetail(
    selectedId !== "account" ? selectedId : undefined,
    { dateFrom: monthRange.dateFrom, dateTo: monthRange.dateTo },
  );

  const selectedCampaign = campaigns.find((c) => c.id === selectedId) ?? null;
  const campKey = selectedId === "account" ? null : selectedId;

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const messages = activeThread?.messages ?? [];

  const pausedWithSpend = useMemo(
    () => [...campaigns].filter((c) => isPaused(c) && c.spend > 0).sort((a, b) => b.spend - a.spend),
    [campaigns],
  );
  const activeList = useMemo(
    () => [...campaigns].filter(isActive).sort((a, b) => b.spend - a.spend),
    [campaigns],
  );
  const pausedAll = useMemo(
    () => [...campaigns].filter(isPaused).sort((a, b) => b.spend - a.spend),
    [campaigns],
  );

  // Bootstrap threads for org
  useEffect(() => {
    if (!orgId) {
      setThreads([]);
      setActiveThreadId("");
      setReady(true);
      return;
    }
    let list = loadTmThreads(orgId);
    if (!list.length) {
      const t = createTmThread();
      list = [t];
      saveTmThreads(orgId, list);
      saveTmCurrentId(orgId, t.id);
    }
    setThreads(list);
    const cur = loadTmCurrentId(orgId);
    const id = cur && list.some((t) => t.id === cur) ? cur : list[0].id;
    setActiveThreadId(id);
    saveTmCurrentId(orgId, id);
    const thr = list.find((t) => t.id === id);
    if (thr?.campaignExternalId) setSelectedId(thr.campaignExternalId);
    setReady(true);
  }, [orgId]);

  const persistThreads = useCallback(
    (next: TmThread[]) => {
      setThreads(next);
      if (orgId) saveTmThreads(orgId, next);
    },
    [orgId],
  );

  const updateActiveMessages = useCallback(
    (updater: (msgs: TmChatMsg[]) => TmChatMsg[], titlePatch?: string) => {
      if (!activeThreadId) return;
      persistThreads(
        threads.map((t) => {
          if (t.id !== activeThreadId) return t;
          const messages = updater(t.messages);
          return {
            ...t,
            messages,
            title: titlePatch && t.title.startsWith("Nova") ? titlePatch : t.title,
            updatedAt: new Date().toISOString(),
            campaignExternalId: campKey,
            campaignName: selectedCampaign?.name ?? t.campaignName,
          };
        }),
      );
    },
    [activeThreadId, threads, persistThreads, campKey, selectedCampaign?.name],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!compareCampaignIds?.length) return;
    setPendingCompareIds(compareCampaignIds);
    const names = campaigns
      .filter((c) => compareCampaignIds.includes(c.id))
      .map((c) => c.name);
    setInput(
      `Compare lado a lado estas campanhas (${names.join(" · ") || compareCampaignIds.join(", ")}): ` +
        `qual performa melhor, o que reativar/pausar/escalar, e se fizer sentido emita propostas.`,
    );
    onConsumeCompare?.();
  }, [compareCampaignIds, campaigns, onConsumeCompare]);

  const enrichedContext = useMemo(() => {
    const allBrief = [...campaigns].sort((a, b) => b.spend - a.spend).slice(0, 40).map(campaignBrief);
    const pausedBrief = pausedAll.slice(0, 30).map(campaignBrief);
    const pausedSpendBrief = pausedWithSpend.slice(0, 20).map(campaignBrief);
    const activeBrief = activeList.slice(0, 20).map(campaignBrief);

    const selected =
      detail.data?.campaign
        ? {
            ...campaignBrief(detail.data.campaign),
            series: (detail.data.series ?? []).slice(-30),
            adsets: (detail.data.adsets ?? []).slice(0, 15).map((a) => ({
              id: a.id, name: a.name, status: a.status, spend: a.spend,
              cpl: a.cpl, cpm: a.cpm, frequency: a.frequency, leads: a.leads,
            })),
            ads: (detail.data.ads ?? []).slice(0, 20).map((a) => ({
              id: a.id, name: a.name, status: a.status, spend: a.spend,
              cpl: a.cpl, cpm: a.cpm, frequency: a.frequency, ctr: a.ctr, leads: a.leads,
            })),
            period_monthly: monthRange,
          }
        : selectedCampaign
          ? campaignBrief(selectedCampaign)
          : null;

    const compareIds = pendingCompareIds.length ? pendingCompareIds : (compareCampaignIds ?? []);
    const compare = compareIds.length
      ? allBrief.filter((c) => compareIds.includes(c.id))
      : [];

    const counts = {
      total: campaigns.length,
      active: activeList.length,
      paused: pausedAll.length,
      paused_with_spend_in_period: pausedWithSpend.length,
    };

    return {
      ...metaCtx,
      role: "traffic_manager",
      campaigns: allBrief,
      active_campaigns: activeBrief,
      paused_campaigns: pausedBrief,
      paused_campaigns_with_spend: pausedSpendBrief,
      campaign_counts: counts,
      selected_campaign: selected,
      compare_campaigns: compare,
      ad_account_asset_id: meta.selectedAdAccount?.id ?? metaCtx.ad_account_asset_id,
      guidance:
        (metaCtx.guidance ? metaCtx.guidance + " " : "") +
        `STATUS REAL: ${counts.active} ativas, ${counts.paused} pausadas/inativas, ` +
        `${counts.paused_with_spend_in_period} pausadas COM investimento no período. ` +
        `NUNCA diga que não há campanhas inativas se campaign_counts.paused > 0. ` +
        `Para reativação, use paused_campaigns_with_spend (priorizar maior spend / melhor CPL histórico). ` +
        `Métricas de pausadas no período são históricas (gastaram antes de pausar).`,
    };
  }, [
    metaCtx, campaigns, selectedCampaign, detail.data, monthRange,
    compareCampaignIds, pendingCompareIds, meta.selectedAdAccount?.id,
    activeList, pausedAll, pausedWithSpend,
  ]);

  const newThread = () => {
    if (!orgId) return;
    const t = createTmThread({
      campaignExternalId: campKey,
      campaignName: selectedCampaign?.name ?? null,
    });
    const next = [t, ...threads];
    persistThreads(next);
    setActiveThreadId(t.id);
    saveTmCurrentId(orgId, t.id);
  };

  const selectThread = (id: string) => {
    setActiveThreadId(id);
    if (orgId) saveTmCurrentId(orgId, id);
    const thr = threads.find((t) => t.id === id);
    if (thr?.campaignExternalId) setSelectedId(thr.campaignExternalId);
  };

  const deleteThread = (id: string) => {
    if (!orgId) return;
    const next = threads.filter((t) => t.id !== id);
    if (!next.length) {
      const t = createTmThread();
      persistThreads([t]);
      setActiveThreadId(t.id);
      saveTmCurrentId(orgId, t.id);
      return;
    }
    persistThreads(next);
    if (activeThreadId === id) {
      setActiveThreadId(next[0].id);
      saveTmCurrentId(orgId, next[0].id);
    }
  };

  const clearThread = () => {
    if (!activeThreadId || !confirm("Limpar mensagens desta conversa?")) return;
    updateActiveMessages(() => [
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        content: "Conversa limpa. Em que posso ajudar?",
        at: new Date().toISOString(),
      },
    ]);
    toast.success("Conversa limpa");
  };

  const send = async (text: string, opts?: { enableSearch?: boolean }) => {
    const content = text.trim();
    if (!content || loading || !activeThreadId) return;

    const userMsg: TmChatMsg = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
      at: new Date().toISOString(),
    };

    const baseHistory = messages.filter((m) => !m.id.startsWith("welcome"));
    const titlePatch = baseHistory.length === 0 ? titleFromFirstUserMessage(content) : undefined;

    updateActiveMessages(
      (msgs) => [...msgs.filter((m) => !m.id.startsWith("welcome")), userMsg],
      titlePatch,
    );
    setInput("");
    setLoading(true);

    try {
      const history = [...baseHistory, userMsg]
        .slice(-16)
        .map((m) => ({ role: m.role, content: m.content }));

      const enableSearch =
        opts?.enableSearch ?? forceSearch ?? /pesquis|concorr|nicho|benchmark/i.test(content);

      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: {
          messages: history,
          mode: "auto",
          role: "traffic_manager",
          textModel: loadAiSettings().textModel,
          metaContext: enrichedContext,
          organization_id: orgId || metaCtx.organization_id,
          campaign_external_id: campKey,
          campaign_name: selectedCampaign?.name ?? null,
          ad_account_asset_id: meta.selectedAdAccount?.id ?? null,
          thread_id: activeThreadId,
          enableSearch,
          deferMedia: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const proposals = Array.isArray(data?.proposals) ? data.proposals : [];
      const searchResults = data?.search?.results ?? [];
      const rawText = data?.text || "Sem resposta do gerente.";
      const fromTag = extractMoneyLeft(rawText);
      const apiMoney = data?.moneyLeft;
      const moneyLeft: MoneyLeftInsight | null = apiMoney
        ? {
            amountBrl: apiMoney.amount_brl == null ? null : Number(apiMoney.amount_brl),
            period: String(apiMoney.period || "mês"),
            reason: String(apiMoney.reason || ""),
            urgency: String(apiMoney.urgency || "media").startsWith("alt")
              ? "alta"
              : String(apiMoney.urgency || "").startsWith("baix")
                ? "baixa"
                : "media",
            actionHint: apiMoney.action_hint ? String(apiMoney.action_hint) : undefined,
          }
        : fromTag.insight;

      const assistantMsg: TmChatMsg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: fromTag.cleaned,
        at: new Date().toISOString(),
        sources: searchResults.map((r: any) => ({ title: r.title, url: r.url })),
        proposals: proposals.map((p: any) => ({ id: p.id, title: p.title })),
        moneyLeft,
      };

      // Persist full turn (read latest threads from storage to avoid stale closure)
      if (orgId) {
        const latest = loadTmThreads(orgId);
        const next = latest.map((t) => {
          if (t.id !== activeThreadId) return t;
          const withoutWelcome = t.messages.filter((m) => !m.id.startsWith("welcome"));
          const alreadyHasUser = withoutWelcome.some((m) => m.id === userMsg.id);
          const msgs = [
            ...(alreadyHasUser ? withoutWelcome : [...withoutWelcome, userMsg]),
            assistantMsg,
          ];
          return {
            ...t,
            messages: msgs,
            title:
              t.title.startsWith("Nova") && titlePatch ? titlePatch : t.title,
            updatedAt: new Date().toISOString(),
            campaignExternalId: campKey,
            campaignName: selectedCampaign?.name ?? t.campaignName,
          };
        });
        persistThreads(next);

        // Best-effort DB memory (org-level backup)
        try {
          await supabase.from("traffic_manager_memories").insert([
            {
              organization_id: orgId,
              user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
              campaign_external_id: campKey,
              campaign_name: selectedCampaign?.name ?? null,
              role: "user",
              content: content.slice(0, 8000),
              sources: [],
              proposal_ids: [],
            },
            {
              organization_id: orgId,
              user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
              campaign_external_id: campKey,
              campaign_name: selectedCampaign?.name ?? null,
              role: "assistant",
              content: fromTag.cleaned.slice(0, 12000),
              sources: searchResults,
              proposal_ids: proposals.map((p: any) => p.id),
            },
          ]);
        } catch {
          /* ignore if table missing */
        }
      }

      if (proposals.length) {
        toast.success(`${proposals.length} proposta(s) em Aprovações`, {
          action: { label: "Ver", onClick: () => navigate("/aprovacoes") },
        });
      }
      if (data?.search?.provider === "none" && enableSearch) {
        toast.message("Web search indisponível", {
          description: data?.search?.error || "Falha na busca via NanoGPT.",
        });
      }
      setPendingCompareIds([]);
    } catch (e: any) {
      toast.error("Falha no Gerente de Tráfego", { description: e?.message });
      updateActiveMessages((msgs) => [
        ...msgs,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: `Não consegui responder agora: ${e?.message ?? "erro desconhecido"}`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const askMonthly = () => {
    send(
      selectedId === "account"
        ? "Análise mensal da conta (ativas E pausadas): o que performou, o que pausar/reativar, dinheiro na mesa e plano de ação."
        : `Análise mensal da campanha "${selectedCampaign?.name ?? selectedId}" (status ${selectedCampaign?.status ?? "?"}): vale manter, pausar ou reativar? Dinheiro na mesa e próximos testes.`,
    );
  };

  return (
    <Card className="flex h-[560px] max-h-[75vh] flex-col overflow-hidden shadow-card lg:h-[620px]">
      <div className="flex min-h-0 flex-1">
        {/* Threads sidebar */}
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-secondary/20 sm:w-[220px]">
          <div className="shrink-0 border-b border-border p-2">
            <Button
              size="sm"
              className="h-8 w-full gap-1.5 bg-gradient-brand text-xs text-primary-foreground"
              onClick={newThread}
              disabled={!orgId}
            >
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-1.5">
              {!ready ? (
                <p className="p-2 text-[11px] text-muted-foreground">Carregando…</p>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-start gap-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                      t.id === activeThreadId
                        ? "bg-gradient-brand-soft"
                        : "hover:bg-secondary/70",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => selectThread(t.id)}
                    >
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2 font-medium leading-snug">{t.title}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="mt-0.5 rounded p-0.5 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      title="Excluir conversa"
                      onClick={() => deleteThread(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Chat panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-display text-sm font-bold">Gerente de Tráfego</p>
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", metaCtx.connected ? "bg-success" : "bg-muted-foreground")} />
                    {metaCtx.connected ? "Meta conectada" : "Aguardando Meta"}
                  </span>
                  {metaCtx.connected && (
                    <span>
                      {activeList.length} ativas · {pausedAll.length} pausadas
                      {pausedWithSpend.length > 0 ? ` · ${pausedWithSpend.length} pausadas c/ gasto` : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant={forceSearch ? "default" : "ghost"}
                className="h-8 w-8"
                title="Forçar web search"
                onClick={() => setForceSearch((v) => !v)}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Limpar conversa" onClick={clearThread}>
                <Eraser className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 w-full max-w-[260px] text-xs">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">Conta inteira</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {isPaused(c) ? "(Pausada)" : isActive(c) ? "" : `(${c.status})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={askMonthly} disabled={loading || !metaCtx.connected}>
              <Sparkles className="mr-1 h-3 w-3" /> Análise mensal
            </Button>
            {selectedCampaign && (
              <Badge variant="outline" className="text-[10px]">
                {selectedCampaign.status} · {formatCurrency(selectedCampaign.spend)}
              </Badge>
            )}
          </div>

          {metaCtx.connected && metaCtx.summary && (
            <div className="shrink-0 border-b border-border bg-gradient-brand-soft/40 px-3 py-1.5 text-[11px] text-muted-foreground">
              Conta: {formatCurrency(metaCtx.summary.spend ?? 0)} · {formatNumber(metaCtx.summary.leads ?? 0)} leads ·
              CPM {formatMetaCurrency(metaCtx.summary.cpm)} · ROAS {formatRoas(metaCtx.summary.roas)}
              {forceSearch ? " · search ON" : ""}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-3 px-3 py-3 pr-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 shadow-sm",
                      m.role === "user"
                        ? "ml-8 bg-primary text-primary-foreground"
                        : "mr-2 border border-border bg-card",
                    )}
                  >
                    <CollapsibleChatBody
                      content={m.content}
                      tone={m.role === "user" ? "user" : "assistant"}
                      moneyLeft={m.moneyLeft}
                    />
                    {!!m.sources?.length && (
                      <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                        <p className="font-semibold uppercase tracking-wide">Fontes</p>
                        {m.sources.slice(0, 5).map((s) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">
                            {s.title || s.url}
                          </a>
                        ))}
                      </div>
                    )}
                    {!!m.proposals?.length && (
                      <button
                        type="button"
                        className="mt-2 text-[10px] font-semibold text-primary underline"
                        onClick={() => navigate("/aprovacoes")}
                      >
                        {m.proposals.length} proposta(s) → Aprovações
                      </button>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>
          </div>

          <div className="shrink-0 flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] hover:bg-secondary"
                onClick={() => send(q, { enableSearch: /pesquis|concorr|nicho/i.test(q) })}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>

          <form
            className="shrink-0 flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ao gerente de tráfego…"
              rows={2}
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 bg-gradient-brand text-primary-foreground" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
