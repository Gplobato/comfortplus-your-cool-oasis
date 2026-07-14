import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const mask = (v: string, revealed: boolean) => (revealed ? v : `${v.slice(0, 6)}${"•".repeat(20)}${v.slice(-4)}`);

export default function SecuritySettingsPage() {
  const [show, setShow] = useState(false);
  const token = "sk_live_51NpQxT7HKzXyz1234567890abcdefGHIJKL";

  return (
    <>
      <PageHeader title="Segurança" description="Autenticação, sessões, chaves de API e limites financeiros." />
      <div className="space-y-4 p-4 md:p-8">
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold">Autenticação em dois fatores</h3>
              <p className="text-xs text-muted-foreground">Adicione uma camada extra de proteção via app autenticador.</p>
            </div>
            <Switch defaultChecked />
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold">Chaves de API</h3>
          <p className="text-xs text-muted-foreground">Chaves usadas por integrações externas. Nunca são exibidas por completo.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <Input readOnly value={mask(token, show)} className="border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(token); toast.success("Copiado"); }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
            <div>
              <Label>Webhook secret</Label>
              <Input readOnly className="mt-1.5 font-mono text-xs" value="whsec_••••••••••••••••7d3a" />
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold">Limites financeiros</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div><Label>Máximo por campanha</Label><Input className="mt-1.5" defaultValue="R$ 500/dia" /></div>
            <div><Label>Máximo por conta/mês</Label><Input className="mt-1.5" defaultValue="R$ 50.000" /></div>
            <div><Label>% máx. de aumento sem aprovação</Label><Input className="mt-1.5" defaultValue="10%" /></div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold">Sessões ativas</h3>
          <div className="mt-3 space-y-2 text-sm">
            {[
              { d: "Chrome / macOS", ip: "191.32.14.22", loc: "São Paulo, BR", now: true },
              { d: "iPhone Safari", ip: "191.32.14.90", loc: "São Paulo, BR", now: false },
            ].map((s) => (
              <div key={s.ip} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                <div>
                  <p className="font-medium">{s.d}</p>
                  <p className="text-xs text-muted-foreground">{s.ip} · {s.loc}</p>
                </div>
                {s.now ? <Badge className="border-0 bg-success-soft text-success">Atual</Badge> : <Button size="sm" variant="ghost" className="text-destructive">Encerrar</Button>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
