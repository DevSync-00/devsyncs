-- Encrypted outbound team integrations and durable delivery history.

CREATE TABLE IF NOT EXISTS public.team_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('slack', 'teams', 'generic')),
  name text NOT NULL,
  encrypted_webhook_url text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]',
  enabled boolean NOT NULL DEFAULT true,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.team_integrations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivering', 'delivered', 'failed')),
  payload jsonb NOT NULL,
  response_status integer,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.background_jobs DROP CONSTRAINT IF EXISTS background_jobs_job_type_check;
ALTER TABLE public.background_jobs ADD CONSTRAINT background_jobs_job_type_check
  CHECK (job_type IN ('github_pr_review', 'promotion_execute', 'integration_delivery'));

CREATE INDEX IF NOT EXISTS idx_team_integrations_team ON public.team_integrations(team_id, enabled);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_integration ON public.integration_deliveries(integration_id, created_at DESC);
ALTER TABLE public.team_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_integrations_read ON public.team_integrations FOR SELECT USING (public.check_team_membership(team_id));
CREATE POLICY team_integrations_manage ON public.team_integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_integrations.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_integrations.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
);
CREATE POLICY integration_deliveries_read ON public.integration_deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.team_integrations ti WHERE ti.id = integration_id AND public.check_team_membership(ti.team_id))
);
REVOKE INSERT, UPDATE, DELETE ON public.integration_deliveries FROM authenticated, anon;
