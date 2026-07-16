-- Unified creatives library: Meta-synced + AI-generated + uploads
CREATE TYPE public.creative_source AS ENUM ('meta', 'ai', 'upload');

CREATE TABLE public.creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source public.creative_source NOT NULL DEFAULT 'meta',
  meta_creative_id text,
  meta_ad_account_id text,
  name text NOT NULL,
  type text,
  object_type text,
  status text,
  thumbnail_url text,
  media_url text,
  headline text,
  primary_text text,
  cta text,
  format text,
  created_by_ai boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  in_use boolean NOT NULL DEFAULT false,
  ads_count integer NOT NULL DEFAULT 0,
  active_ads_count integer NOT NULL DEFAULT 0,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creatives_meta_id_unique UNIQUE (organization_id, meta_creative_id)
);

CREATE INDEX creatives_org_idx ON public.creatives (organization_id, updated_at DESC);
CREATE INDEX creatives_org_source_idx ON public.creatives (organization_id, source);
CREATE INDEX creatives_org_in_use_idx ON public.creatives (organization_id, in_use) WHERE in_use = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatives TO authenticated;
GRANT ALL ON public.creatives TO service_role;
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read creatives"
  ON public.creatives FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members insert creatives"
  ON public.creatives FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members update creatives"
  ON public.creatives FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members delete creatives"
  ON public.creatives FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_creatives_updated
  BEFORE UPDATE ON public.creatives
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
