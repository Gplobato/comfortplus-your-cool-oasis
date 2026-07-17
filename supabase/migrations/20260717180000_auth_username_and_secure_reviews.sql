-- Email/password profiles, username aliases and server-owned proposal reviews.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM lower(u.email);

UPDATE public.profiles
SET username = lower(regexp_replace(username, '\s+', '', 'g'))
WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (
      username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username text;
BEGIN
  requested_username := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    '\s+',
    '',
    'g'
  ));
  IF requested_username = '' THEN requested_username := NULL; END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    requested_username,
    lower(NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        username = COALESCE(public.profiles.username, EXCLUDED.username);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "profile self read" ON public.profiles;
DROP POLICY IF EXISTS "org members read colleague profiles" ON public.profiles;
CREATE POLICY "org members read colleague profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members member
      WHERE member.user_id = profiles.id
        AND public.is_org_member(member.organization_id, auth.uid())
    )
  );

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, default_organization_id, username)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "org members review proposals" ON public.action_proposals;
DROP POLICY IF EXISTS "approvers review proposals" ON public.action_proposals;
CREATE POLICY "approvers review proposals"
  ON public.action_proposals FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), organization_id, 'admin')
    OR public.has_role(auth.uid(), organization_id, 'approver')
  )
  WITH CHECK (
    public.has_role(auth.uid(), organization_id, 'admin')
    OR public.has_role(auth.uid(), organization_id, 'approver')
  );

-- Reviews and their audit trail are now written by the authenticated Edge Function.
REVOKE INSERT ON public.audit_logs FROM authenticated;

NOTIFY pgrst, 'reload schema';
