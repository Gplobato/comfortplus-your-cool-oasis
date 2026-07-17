-- Idempotent gallery bootstrap. Safe if creatives never landed via earlier migrations.
DO $$ BEGIN
  CREATE TYPE public.creative_source AS ENUM ('meta', 'ai', 'upload');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source public.creative_source NOT NULL DEFAULT 'upload',
  meta_creative_id text,
  meta_ad_account_id text,
  name text NOT NULL,
  type text,
  object_type text,
  status text DEFAULT 'draft',
  thumbnail_url text,
  media_url text,
  headline text,
  primary_text text,
  cta text,
  format text,
  destination_url text,
  description text,
  width integer,
  height integer,
  file_size bigint,
  mime_type text,
  storage_path text,
  tags text[] NOT NULL DEFAULT '{}',
  archived_at timestamptz,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'ready', 'published', 'failed')),
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

ALTER TABLE public.creatives
  ADD COLUMN IF NOT EXISTS destination_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS creatives_org_idx ON public.creatives (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creatives_org_source_idx ON public.creatives (organization_id, source);
CREATE INDEX IF NOT EXISTS creatives_org_in_use_idx ON public.creatives (organization_id, in_use) WHERE in_use = true;
CREATE INDEX IF NOT EXISTS creatives_org_archived_idx ON public.creatives (organization_id, archived_at, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatives TO authenticated;
GRANT ALL ON public.creatives TO service_role;
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read creatives" ON public.creatives;
DROP POLICY IF EXISTS "org members insert creatives" ON public.creatives;
DROP POLICY IF EXISTS "org members update creatives" ON public.creatives;
DROP POLICY IF EXISTS "org members delete creatives" ON public.creatives;

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

DROP TRIGGER IF EXISTS trg_creatives_updated ON public.creatives;
CREATE TRIGGER trg_creatives_updated
  BEFORE UPDATE ON public.creatives
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creative-assets',
  'creative-assets',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "org members read creative assets" ON storage.objects;
DROP POLICY IF EXISTS "org members upload creative assets" ON storage.objects;
DROP POLICY IF EXISTS "org members update creative assets" ON storage.objects;
DROP POLICY IF EXISTS "org members delete creative assets" ON storage.objects;

CREATE POLICY "org members read creative assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'creative-assets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "org members upload creative assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'creative-assets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "org members update creative assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'creative-assets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'creative-assets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "org members delete creative assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'creative-assets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.creative_campaign_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES public.creatives(id) ON DELETE CASCADE,
  campaign_external_id text NOT NULL,
  campaign_name text,
  adset_external_id text,
  adset_name text,
  meta_creative_id text,
  meta_ad_id text,
  publication_status text NOT NULL DEFAULT 'linked'
    CHECK (publication_status IN ('linked', 'queued', 'published', 'failed')),
  publication_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creative_id, campaign_external_id, adset_external_id)
);

CREATE INDEX IF NOT EXISTS creative_campaign_links_org_idx
  ON public.creative_campaign_links (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_campaign_links_creative_idx
  ON public.creative_campaign_links (creative_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_campaign_links TO authenticated;
GRANT ALL ON public.creative_campaign_links TO service_role;
ALTER TABLE public.creative_campaign_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read creative links" ON public.creative_campaign_links;
DROP POLICY IF EXISTS "org members insert creative links" ON public.creative_campaign_links;
DROP POLICY IF EXISTS "org members update creative links" ON public.creative_campaign_links;
DROP POLICY IF EXISTS "org members delete creative links" ON public.creative_campaign_links;

CREATE POLICY "org members read creative links"
  ON public.creative_campaign_links FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members insert creative links"
  ON public.creative_campaign_links FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members update creative links"
  ON public.creative_campaign_links FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members delete creative links"
  ON public.creative_campaign_links FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_creative_campaign_links_updated ON public.creative_campaign_links;
CREATE TRIGGER trg_creative_campaign_links_updated
  BEFORE UPDATE ON public.creative_campaign_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.organization_ai_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  text_model text NOT NULL DEFAULT 'zai-org/glm-5.2',
  image_model text NOT NULL DEFAULT 'gpt-image-2',
  video_model text NOT NULL DEFAULT 'happyhorse-1.1',
  autonomy_level smallint NOT NULL DEFAULT 3 CHECK (autonomy_level BETWEEN 1 AND 5),
  allow_direct_pause boolean NOT NULL DEFAULT true,
  allow_direct_paused_drafts boolean NOT NULL DEFAULT true,
  require_approval_activation boolean NOT NULL DEFAULT true,
  require_approval_budget boolean NOT NULL DEFAULT true,
  max_daily_budget_brl numeric(12,2),
  max_budget_change_percent numeric(5,2) NOT NULL DEFAULT 20
    CHECK (max_budget_change_percent > 0 AND max_budget_change_percent <= 100),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organization_ai_settings TO authenticated;
GRANT ALL ON public.organization_ai_settings TO service_role;
ALTER TABLE public.organization_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read ai settings" ON public.organization_ai_settings;
DROP POLICY IF EXISTS "org members insert ai settings" ON public.organization_ai_settings;
DROP POLICY IF EXISTS "org members update ai settings" ON public.organization_ai_settings;

CREATE POLICY "org members read ai settings"
  ON public.organization_ai_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members insert ai settings"
  ON public.organization_ai_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members update ai settings"
  ON public.organization_ai_settings FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'approval';

CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_idempotency_idx
  ON public.action_proposals (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
