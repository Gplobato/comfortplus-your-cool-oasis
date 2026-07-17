import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
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
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Database, Json } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/format";

type AuditRow = Database["public"]["Tables"]["audit_logs"]["Row"];

function metaPreview(meta: Json) {
  if (meta == null) return "—";
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return "—";
  }
}

export default function HistoryPage() {
  const { activeOrg } = useOrganization();
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Log de auditoria real da organização — conexões Meta, syncs e revisões."
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
          </Button>
        }
      />
      <div className="p-4 md:p-8">
        <Card className="shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhum evento ainda"
              description="Conectar a Meta, sincronizar ou aprovar propostas gera entradas aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Origem</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Evento</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Entidade</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Ação</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((l) => (
                    <TableRow key={l.id} className="border-border">
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(l.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          {l.agent_id ? (
                            <Sparkles className="h-3 w-3 text-accent" />
                          ) : (
                            <User className="h-3 w-3 text-muted-foreground" />
                          )}
                          {l.agent_id || (l.user_id ? l.user_id.slice(0, 8) : "sistema")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.event_type}</TableCell>
                      <TableCell className="text-sm">
                        {l.entity_type ? (
                          <Badge variant="outline" className="font-normal">
                            {l.entity_type}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {l.action || metaPreview(l.sanitized_metadata).slice(0, 80)}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActive(l)}>
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.event_type}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Ação:</span> {active.action ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Entidade:</span>{" "}
                {active.entity_type ?? "—"} {active.entity_id ? `(${active.entity_id})` : ""}
              </div>
              <div>
                <span className="text-muted-foreground">Usuário:</span> {active.user_id ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Agente:</span> {active.agent_id ?? "—"}
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Metadados</p>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">
                  {metaPreview(active.sanitized_metadata)}
                </pre>
              </div>
              <div>
                <span className="text-muted-foreground">Horário:</span> {formatDateTime(active.created_at)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
