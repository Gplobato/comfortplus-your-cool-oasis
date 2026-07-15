
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin','manager','analyst','creative','approver','viewer');
CREATE TYPE public.meta_connection_status AS ENUM ('pending','active','degraded','reauth_required','revoked','error');
CREATE TYPE public.mcp_session_status AS ENUM ('initializing','active','expired','failed','closed');
CREATE TYPE public.proposal_status AS ENUM ('draft','awaiting_approval','approved','rejected','expired','executing','completed','failed','partially_completed','rolled_back');
CREATE TYPE public.execution_status AS ENUM ('pending','running','succeeded','failed','verified','unverified','rolled_back');
CREATE TYPE public.risk_level AS ENUM ('read','draft','reversible','financial','destructive');
CREATE TYPE public.meta_asset_type AS ENUM ('business','ad_account','page','instagram_account','pixel','catalog');

-- =========================================================
-- utility: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- ORGANIZATIONS
-- =========================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- membership helper (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = _user
  )
$$;

CREATE POLICY "org members read own orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "members read own memberships" ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- USER ROLES (scoped by organization)
-- =========================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org AND role = _role
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  default_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "profile self read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profile self update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- META CONNECTIONS  (tokens: NEVER exposed to frontend)
-- =========================================================
CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'meta',
  external_user_id text,
  display_name text,
  status public.meta_connection_status NOT NULL DEFAULT 'pending',
  granted_scopes text[] NOT NULL DEFAULT '{}',
  encrypted_access_token text,      -- backend-only (RLS blocks frontend)
  encrypted_refresh_token text,     -- backend-only
  token_expires_at timestamptz,
  last_health_check_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_message_sanitized text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately NO grant of SELECT on encrypted token columns to authenticated.
-- Grant only non-sensitive columns to authenticated via a view below.
GRANT ALL ON public.meta_connections TO service_role;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_meta_connections_updated BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated => frontend cannot
-- touch this table directly. All access via edge functions (service_role).

-- Safe view for the frontend (no tokens)
CREATE VIEW public.meta_connections_public AS
SELECT id, organization_id, connected_by_user_id, provider, external_user_id,
       display_name, status, granted_scopes, token_expires_at,
       last_health_check_at, last_success_at, last_error_code,
       last_error_message_sanitized, revoked_at, created_at, updated_at
FROM public.meta_connections;
GRANT SELECT ON public.meta_connections_public TO authenticated;
ALTER VIEW public.meta_connections_public SET (security_invoker = true);

CREATE POLICY "org members see connections (non-token via view)"
  ON public.meta_connections FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- ^ view uses security_invoker; the underlying policy still runs.
-- But we still don't grant column SELECT to authenticated, so direct SELECT * fails.
-- The view exposes only whitelisted columns.

-- =========================================================
-- META ASSETS
-- =========================================================
CREATE TABLE public.meta_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  asset_type public.meta_asset_type NOT NULL,
  external_id text NOT NULL,
  name text,
  currency text,
  timezone text,
  status text,
  metadata_sanitized jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, asset_type, external_id)
);
GRANT SELECT ON public.meta_assets TO authenticated;
GRANT ALL ON public.meta_assets TO service_role;
ALTER TABLE public.meta_assets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_meta_assets_updated BEFORE UPDATE ON public.meta_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "org members read assets" ON public.meta_assets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- MCP TOOL CATALOG
-- =========================================================
CREATE TABLE public.mcp_tool_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'meta',
  server_identifier text NOT NULL,
  tool_name text NOT NULL,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level public.risk_level NOT NULL DEFAULT 'read',
  enabled boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  schema_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, server_identifier, tool_name)
);
GRANT SELECT ON public.mcp_tool_catalog TO authenticated;
GRANT ALL ON public.mcp_tool_catalog TO service_role;
ALTER TABLE public.mcp_tool_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated reads catalog" ON public.mcp_tool_catalog
  FOR SELECT TO authenticated USING (true);

-- =========================================================
-- MCP SESSIONS
-- =========================================================
CREATE TABLE public.mcp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  encrypted_session_reference text,
  protocol_version text,
  status public.mcp_session_status NOT NULL DEFAULT 'initializing',
  initialized_at timestamptz,
  expires_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mcp_sessions TO service_role;
ALTER TABLE public.mcp_sessions ENABLE ROW LEVEL SECURITY;
-- backend-only

-- =========================================================
-- ACTION PROPOSALS
-- =========================================================
CREATE TABLE public.action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_asset_id uuid REFERENCES public.meta_assets(id) ON DELETE SET NULL,
  created_by_agent text,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  explanation text,
  rationale text,
  tool_name text NOT NULL,
  proposed_arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_state jsonb,
  proposed_state jsonb,
  diff jsonb,
  risk_level public.risk_level NOT NULL DEFAULT 'reversible',
  estimated_impact text,
  status public.proposal_status NOT NULL DEFAULT 'draft',
  expires_at timestamptz,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.action_proposals TO authenticated;
GRANT ALL ON public.action_proposals TO service_role;
ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_action_proposals_updated BEFORE UPDATE ON public.action_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "org members read proposals" ON public.action_proposals
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- ACTION EXECUTIONS
-- =========================================================
CREATE TABLE public.action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.action_proposals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  sanitized_arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  status public.execution_status NOT NULL DEFAULT 'pending',
  sanitized_result jsonb,
  error_code text,
  error_message_sanitized text,
  verification_status text,
  rollback_reference text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.action_executions TO authenticated;
GRANT ALL ON public.action_executions TO service_role;
ALTER TABLE public.action_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read executions" ON public.action_executions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id text,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  action text,
  sanitized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
