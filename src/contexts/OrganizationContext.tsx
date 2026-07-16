import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type Organization = { id: string; name: string; slug: string };

type OrgContextValue = {
  organizations: Organization[];
  activeOrg: Organization | null;
  loading: boolean;
  setActiveOrg: (org: Organization) => void;
  refresh: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
};

const OrgContext = createContext<OrgContextValue | undefined>(undefined);
const STORAGE_KEY = "proads:active-org";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setActiveOrgState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name, slug)")
      .eq("user_id", user.id);

    const orgs: Organization[] = (memberships ?? [])
      .map((m: any) => m.organizations)
      .filter(Boolean);
    setOrganizations(orgs);

    const storedId = localStorage.getItem(STORAGE_KEY);
    const preferred = orgs.find((o) => o.id === storedId) ?? orgs[0] ?? null;
    setActiveOrgState(preferred);
    if (preferred) localStorage.setItem(STORAGE_KEY, preferred.id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveOrg = (org: Organization) => {
    setActiveOrgState(org);
    localStorage.setItem(STORAGE_KEY, org.id);
  };

  const createOrganization = async (name: string): Promise<Organization> => {
    if (!user) throw new Error("Não autenticado");
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `org-${Date.now()}`;
    const slug = `${base}-${Date.now().toString(36)}`;
    const { data, error } = await supabase.rpc("create_organization", { _name: name, _slug: slug });
    if (error) throw error;
    const org = Array.isArray(data) ? data[0] : data;
    if (!org) throw new Error("Falha ao criar organização");
    await refresh();
    setActiveOrg(org as Organization);
    return org as Organization;
  };


  return (
    <OrgContext.Provider value={{ organizations, activeOrg, loading, setActiveOrg, refresh, createOrganization }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
