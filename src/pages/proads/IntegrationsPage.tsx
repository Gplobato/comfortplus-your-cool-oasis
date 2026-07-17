import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as Icons from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";

const metaStatusBadge: Record<string, { label: string; className: string }> = {
  connected: { label: "Conectado", className: "bg-success-soft text-success" },
  degraded: { label: "Degradado", className: "bg-warning-soft text-warning" },
  expired: { label: "Reautorizar", className: "bg-warning-soft text-warning" },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive" },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground" },
  connecting: { label: "Conectando", className: "bg-muted text-muted-foreground" },
};

const COMING_SOON = [
  { name: "Google Ads", icon: "Chrome", desc: "Campanhas Search & Performance Max — em breve." },
  { name: "TikTok Ads", icon: "Video", desc: "Tráfego e criativos TikTok — em breve." },
  { name: "WhatsApp Business", icon: "MessageCircle", desc: "Mensagens e CRM — em breve." },
  { name: "Google Analytics", icon: "BarChart3", desc: "Atribuição e funil — em breve." },
];

function MetaCard() {
  const { activeOrg } = useOrganization();
  const meta = useMetaIntegration();
  const [busy, setBusy] = useState<null | "connect" | "test" | "disconnect" | "select">(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const flag = params.get("meta");
    if (!flag) return;
    if (flag === "connected") toast.success("Meta conectada com sucesso");
    else if (flag === "error") {
      toast.error("Falha ao conectar Meta", {
        description: params.get("detail") || params.get("reason") || "erro desconhecido",
      });
    }
    params.delete("meta");
    params.delete("reason");
    params.delete("detail");
    setParams(params, { replace: true });
    meta.refreshStatus();
  }, [params, setParams, meta]);

  const handleConnect = async () => {
    if (!activeOrg) return;
    setBusy("connect");
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: { organization_id: activeOrg.id, return_origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error("URL de autorização não retornada");
      window.location.href = data.authUrl;
    } catch (e: any) {
      toast.error("Falha ao iniciar OAuth", { description: e?.message });
      setBusy(null);
    }
  };

  const handleTest = async () => {
    if (!activeOrg) return;
    setBusy("test");
    try {
      const { data, error } = await supabase.functions.invoke("meta-connection", {
        body: { action: "test", organization_id: activeOrg.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Conexão OK");
      await meta.refreshStatus();
    } catch (e: any) {
      toast.error("Teste falhou", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!activeOrg) return;
    if (!confirm("Desconectar a Meta desta organização?")) return;
    setBusy("disconnect");
    try {
      const { data, error } = await supabase.functions.invoke("meta-connection", {
        body: { action: "disconnect", organization_id: activeOrg.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Meta desconectada");
      await meta.refreshStatus();
    } catch (e: any) {
      toast.error("Falha ao desconectar", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleSelect = async (assetId: string) => {
    setBusy("select");
    try {
      await meta.selectAdAccount(assetId);
      toast.success("Conta selecionada");
      meta.sync().catch(() => {});
    } catch (e: any) {
      toast.error("Falha ao selecionar", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const badge = metaStatusBadge[meta.connectionStatus] ?? metaStatusBadge.disconnected;

  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand-soft text-primary">
            <Icons.Facebook className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display font-bold">Meta Ads</p>
            <p className="text-[11px] text-muted-foreground">
              Leitura completa + escrita gradual (pausar anúncio/conjunto/campanha) após aprovação humana.
              Escopos: ads_read, ads_management, business_management.
            </p>
          </div>
        </div>
        <Badge className={cn("border-0", badge.className)}>{badge.label}</Badge>
      </div>

      {meta.loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando status...</p>
      ) : !meta.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            O ProAds solicita <code className="text-[10px]">ads_read</code>,{" "}
            <code className="text-[10px]">ads_management</code> e{" "}
            <code className="text-[10px]">business_management</code>. Alterações só ocorrem após aprovação
            em Aprovações (ex.: pausar anúncio).
          </p>
          <Button
            onClick={handleConnect}
            disabled={busy === "connect" || !activeOrg}
            className="w-full bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
          >
            {busy === "connect" ? "Abrindo Meta..." : "Conectar Meta"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-muted-foreground">Usuário conectado</p>
              <p className="font-semibold">{meta.status?.connected_user?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Última sincronização</p>
              <p className="font-semibold">{meta.lastSyncAt ? formatDateTime(meta.lastSyncAt) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Token</p>
              <p className="font-semibold capitalize">{meta.status?.token_status ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contas disponíveis</p>
              <p className="font-semibold">{meta.availableAdAccounts.length}</p>
            </div>
          </div>

          {meta.lastError && (
            <div className="rounded-md border border-warning/40 bg-warning-soft/40 p-2 text-[11px] text-warning-foreground">
              {meta.lastError}
            </div>
          )}

          <div>
            <Label className="text-[11px]">Conta de anúncio ativa</Label>
            {meta.availableAdAccounts.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Nenhuma conta de anúncios disponível. Verifique permissões no Meta Business.
              </p>
            ) : (
              <Select
                value={meta.selectedAdAccount?.id ?? ""}
                onValueChange={handleSelect}
                disabled={busy === "select"}
              >
                <SelectTrigger className="mt-1.5 h-9 text-xs">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {meta.availableAdAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {meta.selectedAdAccount && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                ID: <code>{meta.selectedAdAccount.external_id}</code>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleTest} disabled={busy === "test"}>
              {busy === "test" ? "Testando..." : "Testar conexão"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                meta
                  .sync()
                  .then(() => toast.success("Sincronizado"))
                  .catch((e) => toast.error(e?.message))
              }
            >
              Sincronizar
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleConnect} disabled={busy === "connect"}>
              Reconectar (inclui ads_management)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={busy === "disconnect"}
            >
              Desconectar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte contas reais. Nesta fase, apenas Meta Ads está operacional."
      />
      <div className="space-y-8 p-4 md:p-8">
        <section>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Anúncios
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <MetaCard />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Em breve
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON.map((i) => {
              const IconComp = (Icons as any)[i.icon] ?? Icons.Plug;
              return (
                <Card key={i.name} className="p-4 opacity-80 shadow-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-display font-bold">{i.name}</p>
                        <p className="text-[11px] text-muted-foreground">{i.desc}</p>
                      </div>
                    </div>
                    <Badge className="border-0 bg-muted text-muted-foreground">Em breve</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
