import { useEffect, useState } from "react";
import { Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { auditService } from "@/services";
import type { AuditLog } from "@/types/proads";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyle = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-destructive/10 text-destructive",
};

export default function HistoryPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [active, setActive] = useState<AuditLog | null>(null);
  useEffect(() => { auditService.list().then(setItems); }, []);

  return (
    <>
      <PageHeader title="Histórico" description="Log de auditoria de todas as ações — humanos e agentes IA." />
      <div className="p-4 md:p-8">
        <Card className="shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Usuário</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Ação</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Módulo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {l.agent ? <Sparkles className="h-3 w-3 text-accent" /> : <User className="h-3 w-3 text-muted-foreground" />}
                        {l.user}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{l.action}</TableCell>
                    <TableCell className="text-sm">{l.module}</TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">{l.description}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusStyle[l.status])}>{l.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActive(l)}>Detalhes</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{active?.action}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Módulo:</span> {active.module}</div>
              <div><span className="text-muted-foreground">Conta:</span> {active.account ?? "—"}</div>
              <div><span className="text-muted-foreground">Descrição:</span> {active.description}</div>
              {active.before && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">Antes → depois</p>
                  <p className="mt-1"><strong>{active.before}</strong> → <strong className="text-primary">{active.after}</strong></p>
                </div>
              )}
              {active.approvedBy && <div><span className="text-muted-foreground">Aprovado por:</span> {active.approvedBy}</div>}
              {active.result && <div><span className="text-muted-foreground">Resultado:</span> {active.result}</div>}
              <div><span className="text-muted-foreground">Horário:</span> {formatDateTime(active.createdAt)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
