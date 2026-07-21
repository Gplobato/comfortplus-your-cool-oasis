CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creative_id uuid REFERENCES public.creatives(id) ON DELETE SET NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  title text,
  caption text,
  hashtags text[] NOT NULL DEFAULT '{}',
  cta text,
  link_url text,
  mentions text[] NOT NULL DEFAULT '{}',
  media_url text,
  storage_path text,
  media_type text,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'ready', 'published', 'failed', 'skipped')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai', 'randomized')),
  page_external_id text,
  external_post_id text,
  publish_error text,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_posts_org_schedule_idx ON public.social_posts (organization_id, scheduled_for);
CREATE INDEX social_posts_org_status_idx ON public.social_posts (organization_id, status);
CREATE INDEX social_posts_creative_idx ON public.social_posts (creative_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read social posts"
  ON public.social_posts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members insert social posts"
  ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members update social posts"
  ON public.social_posts FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members delete social posts"
  ON public.social_posts FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_social_posts_updated
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();