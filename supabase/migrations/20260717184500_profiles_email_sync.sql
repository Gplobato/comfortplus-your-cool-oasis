-- Complements auth username migration: syncable email on profiles for username login.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM lower(u.email);

-- Keep trigger writing email when new users sign up.
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

-- Ensure Emanuele alias exists if the account was already created.
UPDATE public.profiles
SET username = 'emanuele',
    full_name = COALESCE(NULLIF(full_name, ''), 'Emanuele'),
    email = 'sac.brosgroup@gmail.com'
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'sac.brosgroup@gmail.com'
);

NOTIFY pgrst, 'reload schema';
