import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { integrationService } from "@/services";
import type { Integration, IntegrationStatus } from "@/types/proads";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

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

type MetaAsset = {
  id: string;
  asset_type: "business" | "ad_account" | string;
  external_id: string;
  name: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
  selected: boolean;
};

type MetaStatus = {
  connected: boolean;
  connection: {
    id: string;
    display_name: string | null;
    status: "pending" | "active" | "degraded" | "reauth_required" | "revoked" | "error";
    granted_scopes: string[] | null;
    token_expires_at: string | null;
    last_success_at: string | null;
    last_health_check_at: string | null;
    last_error_message_sanitized: string | null;
    created_at: string;
  } | null;
  assets: MetaAsset[];
};

const metaStatusBadge: Record<string, { label: string; className: string }> = {
  active: { label: "Conectado", className: "bg-success-soft text-success" },
  pending: { label: "Pendente", className: "bg-warning-soft text-warning" },
  degraded: { label: "Degradado", className: "bg-warning-soft text-warning" },
  reauth_required: { label: "Reautorizar", className: "bg-warning-soft text-warning" },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive" },
  revoked: { label: "Revogado", className: "bg-muted text-muted-foreground" },
};

function MetaCard() {
  const { activeOrg } = useOrganization();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "connect" | "test" | "disconnect" | "select">(null);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-connection?action=status&organization_id=${activeOrg.id}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setStatus(j);
    } catch (e: any) {
      toast.error("Falha ao carregar status Meta", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  // Handle OAuth return
  useEffect(() => {
    const meta = params.get("meta");
    if (!meta) return;
    if (meta === "connected") toast.success("Meta conectada com sucesso");
    else if (meta === "error") {
      toast.error("Falha ao conectar Meta", {
        description: params.get("detail") || params.get("reason") || "erro desconhecido",
      });
    }
    params.delete("meta"); params.delete("reason"); params.delete("detail");
    setParams(params, { replace: true });
    load();
  }, [params, setParams, load]);

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

  const call = async (body: any, msg: string) => {
    const { data, error } = await supabase.functions.invoke("meta-connection", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    toast.success(msg);
    await load();
  };

  const handleTest = async () => {
    if (!activeOrg) return;
    setBusy("test");
    try { await call({ action: "test", organization_id: activeOrg.id }, "Conexão OK"); }
    catch (e: any) { toast.error("Teste falhou", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const handleDisconnect = async () => {
    if (!activeOrg) return;
    if (!confirm("Desconectar a Meta desta organização?")) return;
    setBusy("disconnect");
    try { await call({ action: "disconnect", organization_id: activeOrg.id }, "Meta desconectada"); }
    catch (e: any) { toast.error("Falha ao desconectar", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const handleSelect = async (assetId: string) => {
    if (!activeOrg) return;
    setBusy("select");
    try { await call({ action: "select_account", organization_id: activeOrg.id, asset_id: assetId }, "Conta selecionada"); }
    catch (e: any) { toast.error("Falha ao selecionar", { description: e?.message }); }
    finally { setBusy(null); }
  };

  const adAccounts = useMemo(
    () => (status?.assets ?? []).filter((a) => a.asset_type === "ad_account"),
    [status],
  );
  const businesses = useMemo(
    () => (status?.assets ?? []).filter((a) => a.asset_type === "business"),
    [status],
  );
  const selected = adAccounts.find((a) => a.selected) ?? null;

  const connected = status?.connected && status.connection?.status !== "revoked";
  const s = status?.connection?.status;
  const badge = s ? metaStatusBadge[s] ?? metaStatusBadge.active : null;

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
              Conexão oficial com Business Manager e contas de anúncios. Somente leitura nesta fase.
            </p>
          </div>
        </div>
        {badge ? (
          <Badge className={cn("border-0", badge.className)}>{badge.label}</Badge>
        ) : (
          <Badge className="border-0 bg-muted text-muted-foreground">Desconectado</Badge>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando status...</p>
      ) : !connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Ao conectar, o ProAds solicita apenas <code className="text-[10px]">ads_read</code> e{" "}
            <code className="text-[10px]">business_management</code>. Nenhuma campanha será alterada.
          </p>
          <Button
            onClick={handleConnect}
            disabled={busy === "connect"}
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
              <p className="font-semibold">{status?.connection?.display_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Últ. verificação</p>
              <p className="font-semibold">
                {status?.connection?.last_health_check_at
                  ? formatDateTime(status.connection.last_health_check_at)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Escopos</p>
              <p className="font-semibold truncate">
                {(status?.connection?.granted_scopes ?? []).join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Business Managers</p>
              <p className="font-semibold">{businesses.length}</p>
            </div>
          </div>

          {status?.connection?.last_error_message_sanitized && (
            <div className="rounded-md border border-warning/40 bg-warning-soft/40 p-2 text-[11px] text-warning-foreground">
              {status.connection.last_error_message_sanitized}
            </div>
          )}

          <div>
            <Label className="text-[11px]">Conta de anúncio ativa</Label>
            {adAccounts.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Nenhuma conta de anúncios disponível. Verifique permissões no Meta Business.
              </p>
            ) : (
              <Select
                value={selected?.id ?? ""}
                onValueChange={handleSelect}
                disabled={busy === "select"}
              >
                <SelectTrigger className="mt-1.5 h-9 text-xs">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name ?? a.external_id} · {a.currency ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleTest} disabled={busy === "test"}>
              {busy === "test" ? "Testando..." : "Testar conexão"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleConnect} disabled={busy === "connect"}>
              Reconectar
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
  const [items, setItems] = useState<Integration[]>([]);
  const [active, setActive] = useState<Integration | null>(null);
  useEffect(() => { integrationService.list().then(setItems); }, []);

  // Remove any mock "Meta Ads" card so we render only the real one.
  const filtered = useMemo(
    () => items.filter((i) => !/meta ads?/i.test(i.name)),
    [items],
  );
  const groups = Array.from(new Set(filtered.map((i) => i.category)));

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte suas contas e ferramentas para operar tudo pela ProAds."
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

        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {categoryLabel[g]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.filter((i) => i.category === g).map((i) => {
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
