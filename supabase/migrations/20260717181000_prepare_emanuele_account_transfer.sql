-- Prepare the confirmed Emanuele account while retaining the Google user as rollback.
DO $$
DECLARE
  old_user_id uuid;
  new_user_id uuid;
BEGIN
  SELECT id INTO old_user_id
  FROM auth.users
  WHERE lower(email) = 'gpatricklobatozs@gmail.com'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO new_user_id
  FROM auth.users
  WHERE lower(email) = 'sac.brosgroup@gmail.com'
  ORDER BY created_at
  LIMIT 1;

  IF old_user_id IS NULL THEN
    RAISE EXCEPTION 'source_google_user_not_found';
  END IF;
  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'emanuele_user_not_found';
  END IF;

  UPDATE public.profiles
  SET full_name = 'Emanuele',
      username = 'emanuele',
      email = 'sac.brosgroup@gmail.com',
      default_organization_id = COALESCE(
        default_organization_id,
        (SELECT organization_id
         FROM public.organization_members
         WHERE user_id = old_user_id
         ORDER BY created_at
         LIMIT 1)
      )
  WHERE id = new_user_id;

  INSERT INTO public.organization_members (organization_id, user_id)
  SELECT organization_id, new_user_id
  FROM public.organization_members
  WHERE user_id = old_user_id
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (organization_id, user_id, role)
  SELECT organization_id, new_user_id, role
  FROM public.user_roles
  WHERE user_id = old_user_id
  ON CONFLICT (user_id, organization_id, role) DO NOTHING;

  -- Ensure the replacement account can administer organizations even when the
  -- legacy account predates role creation.
  INSERT INTO public.user_roles (organization_id, user_id, role)
  SELECT organization_id, new_user_id, 'admin'::public.app_role
  FROM public.organization_members
  WHERE user_id = old_user_id
  ON CONFLICT (user_id, organization_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    agent_id,
    event_type,
    entity_type,
    entity_id,
    action,
    sanitized_metadata
  )
  SELECT
    organization_id,
    new_user_id,
    'account-migration',
    'account.transfer.prepared',
    'user',
    new_user_id::text,
    'copy_membership',
    jsonb_build_object('source_user_id', old_user_id, 'rollback_retained', true)
  FROM public.organization_members
  WHERE user_id = old_user_id;
END
$$;

NOTIFY pgrst, 'reload schema';
