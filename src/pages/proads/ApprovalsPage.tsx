import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { PlatformBadge } from "@/components/proads/Badges";
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
import { approvalService } from "@/services";
import type { Approval } from "@/types/proads";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const typeLabel: Record<Approval["type"], string> = {
  new_campaign: "Nova campanha",
  budget_change: "Alteração de orçamento",
  new_creative: "Novo criativo",
  new_audience: "Novo público",
  activate_campaign: "Ativar campanha",
  pause_campaign: "Pausar campanha",
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [active, setActive] = useState<Approval | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => { approvalService.list().then(setItems); }, []);

  const confirm = () => {
    if (!active || !action) return;
    (action === "approve" ? approvalService.approve : approvalService.reject)(active.id, note);
    setItems((prev) => prev.filter((i) => i.id !== active.id));
    toast[action === "approve" ? "success" : "error"](
      `${action === "approve" ? "Aprovado" : "Rejeitado"}: ${active.title}`,
    );
    setActive(null); setAction(null); setNote("");
  };

  return (
    <>
      <PageHeader
        title="Aprovações"
        description="Centro de controle humano — revise cada ação proposta pela IA antes de executar."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select defaultValue="all"><SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos tipos</SelectItem><SelectItem value="budget">Orçamento</SelectItem><SelectItem value="creative">Criativo</SelectItem></SelectContent></Select>
            <Select defaultValue="all"><SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda urgência</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Média</SelectItem></SelectContent></Select>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-8">
        {items.length === 0 ? (
          <Card className="p-10 text-center shadow-card">
            <p className="font-display text-lg font-bold">Nenhuma aprovação pendente</p>
            <p className="mt-1 text-sm text-muted-foreground">Você está em dia! A IA vai avisar quando surgir algo.</p>
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id} className="p-5 shadow-card">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-soft">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-violet-soft text-violet-soft-foreground">{typeLabel[a.type]}</Badge>
                    {a.platform && <PlatformBadge platform={a.platform} />}
                    <Badge
                      className={cn(
                        "border-0",
                        a.urgency === "high" ? "bg-destructive/10 text-destructive" :
                        a.urgency === "medium" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
                      )}
                    >
                      Urgência {a.urgency}
                    </Badge>
                    <Badge variant="outline" className="bg-success-soft text-success">
                      {Math.round(a.confidence * 100)}% confiança
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                  {a.type === "budget_change" && (
                    <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-4">
                        <div><span className="text-xs text-muted-foreground">Orçamento atual:</span> <strong>{a.beforeValue}</strong></div>
                        <div><span className="text-xs text-muted-foreground">Novo orçamento:</span> <strong className="text-primary">{a.afterValue}</strong></div>
                        <Badge className="bg-success-soft text-success">+20%</Badge>
                      </div>
                    </div>
                  )}
                  {a.impact && <p className="mt-2 text-xs text-success">Impacto estimado: {a.impact}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Solicitado por {a.requestedBy} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setActive(a); setAction("reject"); }}>
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                  <Button size="sm" className="gap-1 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => { setActive(a); setAction("approve"); }}>
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
            <DialogTitle>{action === "approve" ? "Aprovar" : "Rejeitar"} — {active?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{active?.description}</p>
            <div>
              <p className="mb-1 font-semibold">Observação (opcional)</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicione um comentário para o histórico..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancelar</Button>
            <Button
              className={cn(action === "approve" ? "bg-gradient-brand text-primary-foreground" : "bg-destructive text-destructive-foreground")}
              onClick={confirm}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
