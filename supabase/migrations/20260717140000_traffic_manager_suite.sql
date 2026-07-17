-- Traffic Manager memory + allow members to insert proposals (agent-assisted)

CREATE TABLE IF NOT EXISTS public.traffic_manager_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campaign_external_id text,
  campaign_name text,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposal_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tm_memories_org_camp_created
  ON public.traffic_manager_memories (organization_id, campaign_external_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.traffic_manager_memories TO authenticated;
GRANT ALL ON public.traffic_manager_memories TO service_role;

ALTER TABLE public.traffic_manager_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read tm memories" ON public.traffic_manager_memories
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members insert tm memories" ON public.traffic_manager_memories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "org members delete tm memories" ON public.traffic_manager_memories
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Members (and service role via admin) may create proposals from the Traffic Manager
GRANT INSERT ON public.action_proposals TO authenticated;

CREATE POLICY "org members create proposals" ON public.action_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Executions: members can read; inserts remain service_role / edge
GRANT INSERT, UPDATE ON public.action_executions TO authenticated;

CREATE POLICY "org members insert executions" ON public.action_executions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members update executions" ON public.action_executions
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
