-- Allow org members to review (approve/reject) action proposals
GRANT UPDATE ON public.action_proposals TO authenticated;

CREATE POLICY "org members review proposals" ON public.action_proposals
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Allow authenticated members to insert their own audit rows (approve/reject)
GRANT INSERT ON public.audit_logs TO authenticated;
