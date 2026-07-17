import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Send, Loader2, Sparkles, Eraser, Search } from "lucide-react";
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

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  sources?: { title: string; url: string }[];
  proposals?: { id: string; title: string }[];
  moneyLeft?: MoneyLeftInsight | null;
};

const QUICK = [
  "Quanto estamos deixando de ganhar?",
  "Faça a análise mensal em linguagem de negócio",
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
  const meta = useMetaIntegration();
  const metaCtx = useMetaAgentContext({ dateFrom, dateTo });
  const camps = useMetaCampaigns({ dateFrom, dateTo });
  const campaigns = camps.data?.campaigns ?? [];
  const [selectedId, setSelectedId] = useState<string>("account");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceSearch, setForceSearch] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [pendingCompareIds, setPendingCompareIds] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const monthRange = useMemo(() => periodRange(30), []);
  const detail = useMetaCampaignDetail(
    selectedId !== "account" ? selectedId : undefined,
    { dateFrom: monthRange.dateFrom, dateTo: monthRange.dateTo },
  );

  const selectedCampaign = campaigns.find((c) => c.id === selectedId) ?? null;
  const campKey = selectedId === "account" ? null : selectedId;

  const loadMemory = useCallback(async () => {
    if (!activeOrg?.id) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content:
          "Sou seu **Gerente de Tráfego Pago**. Selecione uma organização e conecte a Meta para análises com dados reais, memória por campanha e propostas automáticas.",
        at: new Date().toISOString(),
      }]);
      setMemoryLoaded(true);
      return;
    }
    setMemoryLoaded(false);
    let q = supabase
      .from("traffic_manager_memories")
      .select("id, role, content, sources, proposal_ids, created_at")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: true })
      .limit(40);
    q = campKey
      ? q.eq("campaign_external_id", campKey)
      : q.is("campaign_external_id", null);
    const { data, error } = await q;
    if (error || !data?.length) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: campKey
          ? `Memória desta campanha vazia. Posso analisar métricas, pesquisar concorrência e criar propostas (ex.: pausar anúncio) para Aprovações.`
          : "Sou seu **Gerente de Tráfego**. Selecione uma campanha ou peça análise da conta. Tenho memória persistente, web search e propostas automáticas.",
        at: new Date().toISOString(),
      }]);
    } else {
      setMessages(
        data
          .filter((r) => r.role === "user" || r.role === "assistant")
          .map((r) => ({
            id: r.id,
            role: r.role as "user" | "assistant",
            content: r.content,
            at: r.created_at,
            sources: Array.isArray(r.sources)
              ? (r.sources as { title?: string; url?: string }[])
                  .filter((s) => s?.url)
                  .map((s) => ({ title: s.title || s.url!, url: s.url! }))
              : undefined,
          })),
      );
    }
    setMemoryLoaded(true);
  }, [activeOrg?.id, campKey]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!compareCampaignIds?.length) return;
    setPendingCompareIds(compareCampaignIds);
    const names = campaigns
      .filter((c) => compareCampaignIds.includes(c.id))
      .map((c) => c.name);
    const prompt =
      `Compare lado a lado estas campanhas (${names.join(" · ") || compareCampaignIds.join(", ")}): ` +
      `qual performa melhor em CPL/CPM/CTR/ROAS, o que pausar ou escalar, e se fizer sentido emita propostas.`;
    setInput(prompt);
    onConsumeCompare?.();
  }, [compareCampaignIds, campaigns, onConsumeCompare]);

  const enrichedContext = useMemo(() => {
    const list = [...campaigns]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 25)
      .map(campaignBrief);
    const selected =
      detail.data?.campaign
        ? {
            ...campaignBrief(detail.data.campaign),
            series: (detail.data.series ?? []).slice(-30),
            adsets: (detail.data.adsets ?? []).slice(0, 15).map((a) => ({
              id: a.id,
              name: a.name,
              status: a.status,
              spend: a.spend,
              cpl: a.cpl,
              cpm: a.cpm,
              frequency: a.frequency,
              leads: a.leads,
            })),
            ads: (detail.data.ads ?? []).slice(0, 20).map((a) => ({
              id: a.id,
              name: a.name,
              status: a.status,
              spend: a.spend,
              cpl: a.cpl,
              cpm: a.cpm,
              frequency: a.frequency,
              ctr: a.ctr,
              leads: a.leads,
            })),
            period_monthly: monthRange,
          }
        : selectedCampaign
          ? campaignBrief(selectedCampaign)
          : null;

    const compareIds = pendingCompareIds.length ? pendingCompareIds : (compareCampaignIds ?? []);
    const compare = compareIds.length ? list.filter((c) => compareIds.includes(c.id)) : [];

    return {
      ...metaCtx,
      role: "traffic_manager",
      campaigns: list,
      selected_campaign: selected,
      compare_campaigns: compare,
      ad_account_asset_id: meta.selectedAdAccount?.id ?? metaCtx.ad_account_asset_id,
      guidance:
        (metaCtx.guidance ? metaCtx.guidance + " " : "") +
        "Você é Gerente de Tráfego Pago. Use summary + campaigns + selected_campaign (+ ads/adsets). " +
        "Para ações claras, emita <propose_action>. Pode pedir/web search para concorrência.",
    };
  }, [metaCtx, campaigns, selectedCampaign, detail.data, monthRange, compareCampaignIds, pendingCompareIds, meta.selectedAdAccount?.id]);

  const clearMemory = async () => {
    if (!activeOrg?.id) return;
    if (!confirm("Apagar memória deste escopo (campanha/conta)?")) return;
    let q = supabase
      .from("traffic_manager_memories")
      .delete()
      .eq("organization_id", activeOrg.id);
    q = campKey
      ? q.eq("campaign_external_id", campKey)
      : q.is("campaign_external_id", null);
    const { error } = await q;
    if (error) toast.error("Falha ao limpar memória", { description: error.message });
    else {
      toast.success("Memória limpa");
      void loadMemory();
    }
  };

  const send = async (text: string, opts?: { enableSearch?: boolean }) => {
    const content = text.trim();
    if (!content || loading) return;
    const userMsg: ChatMsg = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
      at: new Date().toISOString(),
    };
    setMessages((m) => [...m.filter((x) => x.id !== "welcome"), userMsg]);
    setInput("");
    setLoading(true);
    try {
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg]
        .slice(-16)
        .map((m) => ({ role: m.role, content: m.content }));

      const enableSearch = opts?.enableSearch ?? forceSearch ?? /pesquis|concorr|nicho|benchmark/i.test(content);

      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: {
          messages: history,
          mode: "auto",
          role: "traffic_manager",
          textModel: loadAiSettings().textModel,
          metaContext: enrichedContext,
          organization_id: activeOrg?.id ?? metaCtx.organization_id,
          campaign_external_id: campKey,
          campaign_name: selectedCampaign?.name ?? null,
          ad_account_asset_id: meta.selectedAdAccount?.id ?? null,
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
            urgency:
              String(apiMoney.urgency || "media").startsWith("alt")
                ? "alta"
                : String(apiMoney.urgency || "").startsWith("baix")
                  ? "baixa"
                  : "media",
            actionHint: apiMoney.action_hint ? String(apiMoney.action_hint) : undefined,
          }
        : fromTag.insight;

      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: fromTag.cleaned,
          at: new Date().toISOString(),
          sources: searchResults.map((r: any) => ({ title: r.title, url: r.url })),
          proposals: proposals.map((p: any) => ({ id: p.id, title: p.title })),
          moneyLeft,
        },
      ]);

      if (proposals.length) {
        toast.success(`${proposals.length} proposta(s) em Aprovações`, {
          action: { label: "Ver", onClick: () => navigate("/aprovacoes") },
        });
      }
      if (data?.search?.provider === "none" && enableSearch) {
        toast.message("Web search indisponível", {
          description: data?.search?.error || "Falha na busca via NanoGPT. Verifique saldo/créditos da conta.",
        });
      }
      setPendingCompareIds([]);
    } catch (e: any) {
      toast.error("Falha no Gerente de Tráfego", { description: e?.message });
      setMessages((m) => [
        ...m,
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
    if (selectedId === "account") {
      send("Faça a análise mensal da conta (todas as campanhas ativas): o que performou, o que caiu, oportunidades e plano de ação. Se houver anúncios fatigados com ID, proponha pausar.");
    } else {
      send(
        `Faça a análise mensal completa da campanha "${selectedCampaign?.name ?? selectedId}": métricas, fadiga de criativo (frequency), o que melhorar e próximos testes. Emita propostas se houver ação clara.`,
      );
    }
  };

  return (
    <Card className="flex h-[560px] max-h-[70vh] flex-col overflow-hidden shadow-card lg:h-[600px]">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-bold">Gerente de Tráfego</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", metaCtx.connected ? "bg-success" : "bg-muted-foreground")} />
              {metaCtx.connected ? "Meta · memória · propostas · search" : "Aguardando Meta"}
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
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Limpar memória" onClick={() => void clearMemory()}>
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">≠ Criativos</Badge>
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 w-full max-w-[220px] text-xs">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="account">Conta inteira</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={askMonthly} disabled={loading || !metaCtx.connected}>
          <Sparkles className="mr-1 h-3 w-3" /> Análise mensal
        </Button>
        {selectedCampaign && (
          <span className="text-[10px] text-muted-foreground">
            {formatCurrency(selectedCampaign.spend)} · CPL {formatMetaCurrency(selectedCampaign.cpl)} · CTR {formatMetaPercent(selectedCampaign.ctr)}
          </span>
        )}
      </div>

      {metaCtx.connected && metaCtx.summary && (
        <div className="shrink-0 border-b border-border bg-gradient-brand-soft/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          Conta: {formatCurrency(metaCtx.summary.spend ?? 0)} · {formatNumber(metaCtx.summary.leads ?? 0)} leads ·
          CPM {formatMetaCurrency(metaCtx.summary.cpm)} · ROAS {formatRoas(metaCtx.summary.roas)} ·
          {campaigns.length} campanhas
          {forceSearch ? " · search ON" : ""}
        </div>
      )}

      {/* Fixed message viewport with independent scrollbar */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 px-3 py-3 pr-4">
            {!memoryLoaded && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando memória…
              </div>
            )}
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
          className="min-h-[40px] max-h-24 flex-1 resize-none rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
    </Card>
  );
}
