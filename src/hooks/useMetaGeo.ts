import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";

export type MetaGeoPoint = {
  code: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
};

export function useMetaGeo(opts: { dateFrom?: string; dateTo?: string; breakdown?: "country" | "region" } = {}) {
  const { organizationId, selectedAdAccount, connected } = useMetaIntegration();
  const params: Record<string, string> = { organization_id: organizationId ?? "" };
  if (opts.dateFrom) params.date_from = opts.dateFrom;
  if (opts.dateTo) params.date_to = opts.dateTo;
  if (opts.breakdown) params.breakdown = opts.breakdown;

  return useQuery({
    queryKey: ["meta-geo", organizationId, selectedAdAccount?.id ?? null, opts.dateFrom, opts.dateTo, opts.breakdown ?? "country"],
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const qs = new URLSearchParams(params).toString();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-geo?${qs}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `http_${r.status}`);
      return j as { breakdown: string; points: MetaGeoPoint[]; warnings: string[] };
    },
    enabled: !!organizationId && !!selectedAdAccount && connected,
    staleTime: 90_000,
    placeholderData: (prev) => prev,
  });
}
