CREATE TABLE IF NOT EXISTS public.wizard_preview_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text NOT NULL UNIQUE,
  ip_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 2),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt text,
  headline text,
  primary_text text,
  cta text,
  result_url text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS wizard_preview_ip_created_idx
  ON public.wizard_preview_requests (ip_hash, created_at DESC);

ALTER TABLE public.wizard_preview_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wizard_preview_requests FROM anon, authenticated;
GRANT ALL ON public.wizard_preview_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.wizard_waitlist_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  whatsapp text,
  source text NOT NULL DEFAULT 'wizard',
  intent text NOT NULL DEFAULT 'pricing',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wizard_waitlist_email_unique
  ON public.wizard_waitlist_leads (lower(email));

ALTER TABLE public.wizard_waitlist_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wizard_waitlist_leads FROM anon, authenticated;
GRANT ALL ON public.wizard_waitlist_leads TO service_role;

NOTIFY pgrst, 'reload schema';