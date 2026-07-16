
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING organizations.id INTO _org_id;

  INSERT INTO public.organization_members (organization_id, user_id)
  VALUES (_org_id, _uid);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (_uid, _org_id, 'admin');

  INSERT INTO public.audit_logs (organization_id, user_id, event_type, sanitized_metadata)
  VALUES (_org_id, _uid, 'organization.created', jsonb_build_object('name', _name));

  RETURN QUERY
    SELECT o.id, o.name, o.slug FROM public.organizations o WHERE o.id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
