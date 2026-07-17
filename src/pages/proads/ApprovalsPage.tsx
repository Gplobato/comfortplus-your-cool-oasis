import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Database } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Proposal = Database["public"]["Tables"]["action_proposals"]["Row"];
type Risk = Database["public"]["Enums"]["risk_level"];

const riskStyle: Record<Risk, string> = {
  read: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  reversible: "bg-success-soft text-success",
  financial: "bg-warning-soft text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

function actionTypeLabel(t: string) {
  const map: Record<string, string> = {
    budget_change: "Orçamento",
    pause_campaign: "Pausar campanha",
    activate_campaign: "Ativar campanha",
    new_campaign: "Nova campanha",
    new_creative: "Criativo",
    new_audience: "Público",
  };
  return map[t] || t.replace(/_/g, " ");
}

export default function ApprovalsPage() {
  const { activeOrg } = useOrganization();
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [active, setActive] = useState<Proposal | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("action_proposals")
      .select("*")
      .eq("organization_id", activeOrg.id)
      .eq("status", "awaiting_approval")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar aprovações", { description: error.message });
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (typeFilter !== "all" && !p.action_type.includes(typeFilter)) return false;
      if (riskFilter !== "all" && p.risk_level !== riskFilter) return false;
      return true;
    });
  }, [items, typeFilter, riskFilter]);

  const confirm = async () => {
    if (!active || !action || !activeOrg) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const nextStatus = action === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from("action_proposals")
        .update({
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: uid,
          explanation: note
            ? `${active.explanation ?? ""}\n\n[Revisão] ${note}`.trim()
            : active.explanation,
        })
        .eq("id", active.id)
        .eq("organization_id", activeOrg.id);
      if (error) throw error;

      if (uid) {
        await supabase.from("audit_logs").insert({
          organization_id: activeOrg.id,
          user_id: uid,
          event_type: action === "approve" ? "proposal.approved" : "proposal.rejected",
          entity_type: "action_proposal",
          entity_id: active.id,
          action: nextStatus,
          sanitized_metadata: {
            title: active.title,
            action_type: active.action_type,
            note: note || null,
          },
        });
      }

      // Gradual Meta write: pause_* executes after human approval
      if (action === "approve" && String(active.tool_name).startsWith("meta.pause")) {
        const { data: exec, error: execErr } = await supabase.functions.invoke("meta-execute", {
          body: { organization_id: activeOrg.id, proposal_id: active.id },
        });
        if (execErr || exec?.error) {
          const detail = exec?.detail || exec?.message || execErr?.message || exec?.error;
          toast.error("Aprovado, mas a execução na Meta falhou", {
            description: String(detail),
          });
        } else if (exec?.status === "completed") {
          toast.success(`Executado na Meta: ${active.title}`);
        } else if (exec?.status === "approved_only") {
          toast.success(`Aprovado (sem execução automática): ${active.title}`);
        } else {
          toast.success(`Aprovado: ${active.title}`);
        }
      } else {
        toast[action === "approve" ? "success" : "error"](
          `${action === "approve" ? "Aprovado" : "Rejeitado"}: ${active.title}`,
        );
      }

      setItems((prev) => prev.filter((i) => i.id !== active.id));
      setActive(null);
      setAction(null);
      setNote("");
    } catch (e: any) {
      toast.error("Não foi possível registrar a revisão", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Aprovações"
        description="Propostas reais da IA e da operação — revise antes de executar alterações na Meta."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="budget">Orçamento</SelectItem>
                <SelectItem value="creative">Criativo</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo risco</SelectItem>
                <SelectItem value="read">Leitura</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="reversible">Reversível</SelectItem>
                <SelectItem value="financial">Financeiro</SelectItem>
                <SelectItem value="destructive">Destrutivo</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
        {loading ? (
          <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando propostas…
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="shadow-card">
            <EmptyState
              icon={Sparkles}
              title="Nenhuma aprovação pendente"
              description={
                activeOrg
                  ? "Quando a IA ou a operação criar propostas com status aguardando aprovação, elas aparecem aqui."
                  : "Selecione uma organização para ver propostas."
              }
            />
          </Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id} className="p-5 shadow-card">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-soft">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-violet-soft text-violet-soft-foreground">
                      {actionTypeLabel(a.action_type)}
                    </Badge>
                    <Badge className={cn("border-0 capitalize", riskStyle[a.risk_level])}>
                      Risco {a.risk_level}
                    </Badge>
                    {a.created_by_agent && (
                      <Badge variant="outline" className="text-[10px]">
                        Agente: {a.created_by_agent}
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.explanation || a.rationale || "Sem descrição."}
                  </p>
                  {(a.current_state || a.proposed_state) && (
                    <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-4">
                        {a.current_state != null && (
                          <div>
                            <span className="text-xs text-muted-foreground">Atual:</span>{" "}
                            <strong className="text-xs font-mono">
                              {JSON.stringify(a.current_state).slice(0, 120)}
                            </strong>
                          </div>
                        )}
                        {a.proposed_state != null && (
                          <div>
                            <span className="text-xs text-muted-foreground">Proposto:</span>{" "}
                            <strong className="text-xs font-mono text-primary">
                              {JSON.stringify(a.proposed_state).slice(0, 120)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {a.estimated_impact && (
                    <p className="mt-2 text-xs text-success">Impacto estimado: {a.estimated_impact}</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Tool: {a.tool_name} · {formatDateTime(a.created_at)}
                    {String(a.tool_name).startsWith("meta.pause")
                      ? " · Ao aprovar, executa pause na Meta"
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => { setActive(a); setAction("reject"); }}
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1 bg-gradient-brand text-primary-foreground shadow-brand"
                    onClick={() => { setActive(a); setAction("approve"); }}
                  >
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Aprovar" : "Rejeitar"} — {active?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{active?.explanation || active?.rationale}</p>
            <div>
              <p className="mb-1 font-semibold">Observação (opcional)</p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Adicione um comentário para o histórico..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              className={cn(
                action === "approve"
                  ? "bg-gradient-brand text-primary-foreground"
                  : "bg-destructive text-destructive-foreground",
              )}
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
