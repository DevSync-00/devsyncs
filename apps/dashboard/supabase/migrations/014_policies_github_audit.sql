-- Policy evaluation, webhook idempotency, and immutable audit evidence.

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  delivery_id text NOT NULL,
  event_type text NOT NULL,
  action text,
  installation_id bigint,
  repository text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'completed', 'ignored', 'failed')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  UNIQUE(provider, delivery_id)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'github', 'system', 'ai')),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  outcome text NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'denied', 'failed', 'pending')),
  evidence jsonb NOT NULL DEFAULT '{}',
  source_ip_hash text,
  user_agent text,
  previous_hash text,
  event_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_project_created
  ON public.audit_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_team_created
  ON public.audit_events(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_received
  ON public.webhook_deliveries(received_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Webhook deliveries are service-role only.
REVOKE ALL ON public.webhook_deliveries FROM authenticated, anon;

CREATE POLICY audit_events_read ON public.audit_events
  FOR SELECT USING (
    (project_id IS NOT NULL AND public.current_user_can_access_project(project_id))
    OR (team_id IS NOT NULL AND public.check_team_membership(team_id))
    OR actor_id = auth.uid()
  );

-- Audit events are append-only through the service role. Even the service role
-- cannot mutate them accidentally due to the trigger below.
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_audit_event_update ON public.audit_events;
CREATE TRIGGER prevent_audit_event_update
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();

-- Seed a useful default policy for projects that opt into policy enforcement.
-- Project-specific copies are created through the API, keeping this migration
-- independent of existing project rows.
COMMENT ON TABLE public.change_policies IS
  'Policy-as-code rules. Built-in rule IDs: no-breaking-changes, require-owners, require-tests, require-real-rehearsal, require-rollback, max-risk-score.';
