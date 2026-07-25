-- Enterprise tenancy, identity, security, usage, and billing foundation.

CREATE TABLE IF NOT EXISTS public.team_entitlements (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'team', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  features jsonb NOT NULL DEFAULT '{}',
  limits jsonb NOT NULL DEFAULT '{}',
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_security_settings (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  sso_required boolean NOT NULL DEFAULT false,
  sso_provider_id text,
  verified_domains jsonb NOT NULL DEFAULT '[]',
  scim_enabled boolean NOT NULL DEFAULT false,
  session_max_hours integer NOT NULL DEFAULT 168 CHECK (session_max_hours BETWEEN 1 AND 720),
  audit_retention_days integer NOT NULL DEFAULT 90 CHECK (audit_retention_days BETWEEN 30 AND 2555),
  ip_allowlist jsonb NOT NULL DEFAULT '[]',
  require_mfa boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scim_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  raw_attributes jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id),
  UNIQUE(team_id, external_id)
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  metric text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_usage_events_team_metric_time ON public.usage_events(team_id, metric, occurred_at);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_prefix ON public.scim_tokens(token_prefix) WHERE revoked_at IS NULL;
ALTER TABLE public.team_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scim_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY enterprise_team_read_entitlements ON public.team_entitlements FOR SELECT USING (public.check_team_membership(team_id));
CREATE POLICY enterprise_team_read_security ON public.team_security_settings FOR SELECT USING (public.check_team_membership(team_id));
CREATE POLICY enterprise_team_manage_security ON public.team_security_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_security_settings.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_security_settings.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner')
);
CREATE POLICY enterprise_team_read_scim_tokens ON public.scim_tokens FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = scim_tokens.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner')
);
CREATE POLICY enterprise_team_read_scim_identities ON public.scim_identities FOR SELECT USING (public.check_team_membership(team_id));
CREATE POLICY enterprise_team_read_usage ON public.usage_events FOR SELECT USING (public.check_team_membership(team_id));
REVOKE INSERT, UPDATE, DELETE ON public.team_entitlements, public.scim_tokens, public.scim_identities, public.usage_events, public.billing_events FROM authenticated, anon;

INSERT INTO public.team_entitlements(team_id, plan, features, limits)
SELECT id, 'free', '{"sso":false,"scim":false,"auditExport":false,"managedPreviews":false}',
  '{"projects":3,"members":5,"scansPerMonth":100,"managedPreviewHours":0}'
FROM public.teams ON CONFLICT (team_id) DO NOTHING;
