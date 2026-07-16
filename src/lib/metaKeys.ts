// Centralized React Query keys for Meta integration.
// All keys are scoped by organizationId to prevent cross-org cache bleed.

export const metaKeys = {
  all: (orgId: string | null) => ["meta", orgId] as const,
  status: (orgId: string | null) => ["meta", "status", orgId] as const,
  assets: (orgId: string | null) => ["meta", "assets", orgId] as const,
  dashboard: (
    orgId: string | null,
    adAccountId: string | null,
    period?: { from?: string; to?: string; status?: string },
  ) =>
    [
      "meta",
      "dashboard",
      orgId,
      adAccountId,
      period?.from ?? null,
      period?.to ?? null,
      period?.status ?? null,
    ] as const,
  campaigns: (
    orgId: string | null,
    adAccountId: string | null,
    filters?: { status?: string; objective?: string; from?: string; to?: string; search?: string },
  ) =>
    [
      "meta",
      "campaigns",
      orgId,
      adAccountId,
      filters?.status ?? null,
      filters?.objective ?? null,
      filters?.from ?? null,
      filters?.to ?? null,
      filters?.search ?? null,
    ] as const,
  insights: (
    orgId: string | null,
    adAccountId: string | null,
    period?: { from?: string; to?: string },
  ) =>
    [
      "meta",
      "insights",
      orgId,
      adAccountId,
      period?.from ?? null,
      period?.to ?? null,
    ] as const,
  creatives: (
    orgId: string | null,
    adAccountId: string | null,
    filters?: { from?: string; to?: string; inUse?: string },
  ) =>
    [
      "meta",
      "creatives",
      orgId,
      adAccountId,
      filters?.from ?? null,
      filters?.to ?? null,
      filters?.inUse ?? null,
    ] as const,
};

/** Invalidate every meta query for an organization. */
export function metaInvalidationKeys(orgId: string | null) {
  return [
    ["meta", "status", orgId],
    ["meta", "assets", orgId],
    ["meta", "dashboard", orgId],
    ["meta", "campaigns", orgId],
    ["meta", "insights", orgId],
    ["meta", "hierarchy", orgId],
    ["meta", "creatives", orgId],
  ] as const;
}
