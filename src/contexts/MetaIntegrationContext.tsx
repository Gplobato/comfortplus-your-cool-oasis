import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./OrganizationContext";
import { toast } from "sonner";
import { metaInvalidationKeys, metaKeys } from "@/lib/metaKeys";

export type MetaAdAccount = {
  id: string;
  external_id: string;
  account_id: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  status: string | null;
  selected: boolean;
};

export type MetaConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "degraded"
  | "error";

export type MetaStatusPayload = {
  enabled: boolean;
  connected: boolean;
  connection_status: MetaConnectionStatus;
  connection_id: string | null;
  connected_user: { id: string; name: string | null } | null;
  selected_ad_account: MetaAdAccount | null;
  available_ad_accounts: MetaAdAccount[];
  available_ad_accounts_count: number;
  last_sync_at: string | null;
  data_source: "mcp" | "marketing_api" | null;
  token_status: "valid" | "expiring" | "expired" | "unknown" | null;
  last_error: string | null;
  requires_account_selection: boolean;
};

type Ctx = {
  loading: boolean;
  status: MetaStatusPayload | null;
  enabled: boolean;
  connected: boolean;
  connectionStatus: MetaConnectionStatus;
  connectionId: string | null;
  organizationId: string | null;
  selectedAdAccount: MetaAdAccount | null;
  availableAdAccounts: MetaAdAccount[];
  lastSyncAt: string | null;
  lastError: string | null;
  dataSource: "mcp" | "marketing_api" | null;
  refreshStatus: () => Promise<void>;
  selectAdAccount: (id: string) => Promise<void>;
  sync: () => Promise<void>;
};

const MetaIntegrationContext = createContext<Ctx | null>(null);

async function invokeStatus(orgId: string): Promise<MetaStatusPayload> {
  const { data, error } = await supabase.functions.invoke("meta-integration", {
    method: "GET",
    body: undefined,
    // supabase-js doesn't support query params directly for invoke; use fetch fallback
  } as any);
  // Use manual fetch to preserve GET semantics with query string
  if (error || !data) {
    const session = (await supabase.auth.getSession()).data.session;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-integration?organization_id=${orgId}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
    return j;
  }
  return data as MetaStatusPayload;
}

async function fetchStatus(orgId: string): Promise<MetaStatusPayload> {
  const session = (await supabase.auth.getSession()).data.session;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-integration?organization_id=${orgId}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
  return j;
}

export function MetaIntegrationProvider({ children }: { children: ReactNode }) {
  const { activeOrg } = useOrganization();
  const qc = useQueryClient();
  const orgId = activeOrg?.id ?? null;

  const q = useQuery({
    queryKey: metaKeys.status(orgId),
    queryFn: () => fetchStatus(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const invalidateAll = useCallback(async () => {
    await Promise.all(
      metaInvalidationKeys(orgId).map((k) => qc.invalidateQueries({ queryKey: k })),
    );
  }, [qc, orgId]);

  const refreshStatus = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: metaKeys.status(orgId) });
  }, [qc, orgId]);

  const selectAdAccount = useCallback(
    async (assetId: string) => {
      if (!orgId) return;
      const { data, error } = await supabase.functions.invoke("meta-connection", {
        body: { action: "select_account", organization_id: orgId, asset_id: assetId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (import.meta.env.DEV) console.debug("[meta] account.selected", { orgId, assetId });
      await invalidateAll();
    },
    [orgId, invalidateAll],
  );

  const sync = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase.functions.invoke("meta-sync", {
      body: { organization_id: orgId },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    const warns: string[] = (data as any)?.warnings ?? [];
    if (warns.length) toast.warning(`Sincronização concluída com avisos: ${warns[0]}`);
    await invalidateAll();
  }, [orgId, invalidateAll]);

  const status = q.data ?? null;

  const value: Ctx = useMemo(
    () => ({
      loading: q.isLoading || (!q.data && !!orgId),
      status,
      enabled: status?.enabled ?? true,
      connected: !!status?.connected,
      connectionStatus: status?.connection_status ?? "disconnected",
      connectionId: status?.connection_id ?? null,
      organizationId: orgId,
      selectedAdAccount: status?.selected_ad_account ?? null,
      availableAdAccounts: status?.available_ad_accounts ?? [],
      lastSyncAt: status?.last_sync_at ?? null,
      lastError: status?.last_error ?? null,
      dataSource: status?.data_source ?? null,
      refreshStatus,
      selectAdAccount,
      sync,
    }),
    [q.isLoading, q.data, status, orgId, refreshStatus, selectAdAccount, sync],
  );

  return <MetaIntegrationContext.Provider value={value}>{children}</MetaIntegrationContext.Provider>;
}

export function useMetaIntegration(): Ctx {
  const c = useContext(MetaIntegrationContext);
  if (!c) throw new Error("useMetaIntegration must be inside MetaIntegrationProvider");
  return c;
}
