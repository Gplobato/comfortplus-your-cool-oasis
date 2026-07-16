
-- Allow authenticated users to create organizations and bootstrap membership/role/audit
CREATE POLICY "auth users create orgs" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "users add self as member" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users assign own role on new org" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "members write audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id, auth.uid()));
