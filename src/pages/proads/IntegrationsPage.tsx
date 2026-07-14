import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { integrationService } from "@/services";
import type { Integration, IntegrationStatus } from "@/types/proads";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusMap: Record<IntegrationStatus, { label: string; className: string }> = {
  connected: { label: "Conectado", className: "bg-success-soft text-success" },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pendente", className: "bg-warning-soft text-warning" },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive" },
};

const categoryLabel: Record<Integration["category"], string> = {
  ads: "Anúncios",
  messaging: "Mensagens",
  automation: "Automação",
  analytics: "Analytics",
  ai: "IA",
  crm: "CRM",
  media: "Mídia",
};

export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [active, setActive] = useState<Integration | null>(null);
  useEffect(() => { integrationService.list().then(setItems); }, []);

  const groups = Array.from(new Set(items.map((i) => i.category)));

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte suas contas e ferramentas para operar tudo pela ProAds."
      />
      <div className="space-y-8 p-4 md:p-8">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {categoryLabel[g]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.filter((i) => i.category === g).map((i) => {
                const IconComp = (Icons as any)[i.icon] ?? Icons.Plug;
                return (
                  <Card key={i.id} className="p-4 shadow-card transition-shadow hover:shadow-card-md">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand-soft text-primary">
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-display font-bold">{i.name}</p>
                          <p className="text-[11px] text-muted-foreground">{i.description}</p>
                        </div>
                      </div>
                      <Badge className={cn("border-0", statusMap[i.status].className)}>{statusMap[i.status].label}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <p className="text-[10px] text-muted-foreground">
                        {i.lastSync ? `Última sincronização: ${formatDateTime(i.lastSync)}` : "Nunca sincronizado"}
                      </p>
                      {i.status === "connected" ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActive(i)}>Configurar</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => {
                            integrationService.disconnect(i.id);
                            setItems((prev) => prev.map((x) => x.id === i.id ? { ...x, status: "disconnected" } : x));
                            toast.info(`${i.name} desconectado`);
                          }}>Desconectar</Button>
                        </div>
                      ) : (
                        <Button size="sm" className="h-7 gap-1 bg-gradient-brand text-xs text-primary-foreground" onClick={() => setActive(i)}>
                          Conectar
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar {active?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Chave de API</Label><Input placeholder="••••••••••••" className="mt-1.5" /></div>
            <div><Label>Conta padrão</Label><Input placeholder="ID da conta" className="mt-1.5" /></div>
            <p className="text-xs text-muted-foreground">
              As credenciais são armazenadas de forma segura e nunca ficam expostas no frontend.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancelar</Button>
            <Button className="bg-gradient-brand text-primary-foreground" onClick={() => {
              if (!active) return;
              setItems((prev) => prev.map((x) => x.id === active.id ? { ...x, status: "connected", lastSync: new Date().toISOString() } : x));
              toast.success(`${active.name} conectado`);
              setActive(null);
            }}>Conectar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
