-- Server-side AI and Meta action policy. Defaults are intentionally conservative.
CREATE TABLE public.organization_ai_settings (
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

CREATE TRIGGER trg_organization_ai_settings_updated
  BEFORE UPDATE ON public.organization_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'approval'
    CHECK (execution_mode IN ('direct', 'approval'));

CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_idempotency_idx
  ON public.action_proposals (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
