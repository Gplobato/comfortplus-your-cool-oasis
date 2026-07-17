-- Owned creative library. Assets are private and scoped by organization.
ALTER TABLE public.creatives
  ALTER COLUMN source SET DEFAULT 'upload',
  ALTER COLUMN status SET DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS destination_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'ready', 'published', 'failed'));

CREATE INDEX IF NOT EXISTS creatives_org_archived_idx
  ON public.creatives (organization_id, archived_at, updated_at DESC);

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

CREATE TABLE public.creative_campaign_links (
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

CREATE INDEX creative_campaign_links_org_idx
  ON public.creative_campaign_links (organization_id, created_at DESC);
CREATE INDEX creative_campaign_links_creative_idx
  ON public.creative_campaign_links (creative_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_campaign_links TO authenticated;
GRANT ALL ON public.creative_campaign_links TO service_role;
ALTER TABLE public.creative_campaign_links ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER trg_creative_campaign_links_updated
  BEFORE UPDATE ON public.creative_campaign_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
