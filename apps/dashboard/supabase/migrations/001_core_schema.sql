-- DevSync core application schema.
-- This migration is intentionally self-contained so a fresh Supabase project
-- can boot the dashboard/API before analytics migrations are applied.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_team_member(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = team_uuid
      AND tm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.check_team_membership(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_team_member(team_uuid);
$$;

-- ---------------------------------------------------------------------------
-- Core product data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  schema_type text NOT NULL DEFAULT 'prisma',
  db_connection_string text,
  db_secret_id uuid,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS public.scan_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  mismatches jsonb NOT NULL DEFAULT '[]',
  code_schema jsonb,
  db_schema jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_report_id uuid NOT NULL REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  filename text,
  name text,
  content text NOT NULL,
  rollback_content text,
  format text NOT NULL DEFAULT 'sql' CHECK (format IN ('sql', 'prisma')),
  safety_score numeric(5,2),
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_status text NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending', 'running', 'success', 'failed', 'rolled_back')),
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  execution_error text,
  dry_run boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.migration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES public.migrations(id) ON DELETE CASCADE,
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_type text NOT NULL CHECK (execution_type IN ('dry-run', 'dry_run', 'apply', 'rollback')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  sql_executed text,
  error_message text,
  affected_rows integer NOT NULL DEFAULT 0,
  execution_time_ms integer,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Authentication state for CLI/extension device flow
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.device_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  client_id text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Collaboration and reporting surfaces used by the dashboard
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_report_id uuid NOT NULL REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  shared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  permissions jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mismatch_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  mismatch_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid REFERENCES public.migrations(id) ON DELETE CASCADE,
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'closed')),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES public.migrations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  required_approvals integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  migration_id uuid REFERENCES public.migrations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferences jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL,
  template jsonb NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  schedule text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cicd_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Indexes and triggers
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_scan_reports_project_id_created_at ON public.scan_reports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migrations_scan_report_id ON public.migrations(scan_report_id);
CREATE INDEX IF NOT EXISTS idx_migration_history_migration_id ON public.migration_history(migration_id);
CREATE INDEX IF NOT EXISTS idx_device_auth_codes_user_code ON public.device_auth_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_auth_codes_expires_at ON public.device_auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_team_created ON public.activity_feed(team_id, created_at DESC);

DROP TRIGGER IF EXISTS set_teams_updated_at ON public.teams;
CREATE TRIGGER set_teams_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_migrations_updated_at ON public.migrations;
CREATE TRIGGER set_migrations_updated_at BEFORE UPDATE ON public.migrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_mismatch_comments_updated_at ON public.mismatch_comments;
CREATE TRIGGER set_mismatch_comments_updated_at BEFORE UPDATE ON public.mismatch_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mismatch_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cicd_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Teams and members
CREATE POLICY "teams_select_member" ON public.teams
FOR SELECT USING (created_by = auth.uid() OR public.current_user_is_team_member(id));

CREATE POLICY "teams_insert_auth" ON public.teams
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_update_admin" ON public.teams
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
) WITH CHECK (true);

CREATE POLICY "teams_delete_owner" ON public.teams
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id AND tm.user_id = auth.uid() AND tm.role = 'owner'
  )
);

CREATE POLICY "team_members_select_member" ON public.team_members
FOR SELECT USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "team_members_insert_admin" ON public.team_members
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "team_members_update_admin" ON public.team_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
) WITH CHECK (true);

CREATE POLICY "team_members_delete_admin" ON public.team_members
FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
);

-- Project graph policies
CREATE POLICY "projects_member_access" ON public.projects
FOR ALL USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id))
WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "scan_reports_project_access" ON public.scan_reports
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
);

CREATE POLICY "migrations_project_access" ON public.migrations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = migrations.scan_report_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = migrations.scan_report_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
);

CREATE POLICY "migration_history_project_access" ON public.migration_history
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.migrations m
    JOIN public.scan_reports sr ON sr.id = m.scan_report_id
    JOIN public.projects p ON p.id = sr.project_id
    WHERE m.id = migration_history.migration_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (executed_by = auth.uid());

-- Device auth is managed only by server/service role.
CREATE POLICY "device_auth_service_only" ON public.device_auth_codes
FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- User-owned/supporting tables
CREATE POLICY "notifications_user_access" ON public.notifications
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_user_access" ON public.notification_preferences
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_user_access" ON public.api_keys
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "report_templates_access" ON public.report_templates
FOR SELECT USING (is_system OR user_id = auth.uid());

CREATE POLICY "report_templates_user_write" ON public.report_templates
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Broad project/team scoped collaboration access. Application routes still do
-- detailed authorization checks; these policies keep RLS from leaking rows.
CREATE POLICY "activity_feed_team_access" ON public.activity_feed
FOR ALL USING (
  user_id = auth.uid()
  OR public.current_user_is_team_member(team_id)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = activity_feed.project_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "shared_scan_results_project_access" ON public.shared_scan_results
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = shared_scan_results.scan_report_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (shared_by = auth.uid());

CREATE POLICY "mismatch_comments_project_access" ON public.mismatch_comments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = mismatch_comments.scan_report_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (user_id = auth.uid());

CREATE POLICY "change_requests_project_access" ON public.change_requests
FOR ALL USING (
  requested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.migrations m
    JOIN public.scan_reports sr ON sr.id = m.scan_report_id
    JOIN public.projects p ON p.id = sr.project_id
    WHERE m.id = change_requests.migration_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (requested_by = auth.uid());

CREATE POLICY "approval_workflows_project_access" ON public.approval_workflows
FOR ALL USING (
  requested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.migrations m
    JOIN public.scan_reports sr ON sr.id = m.scan_report_id
    JOIN public.projects p ON p.id = sr.project_id
    WHERE m.id = approval_workflows.migration_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (requested_by = auth.uid());

CREATE POLICY "approval_steps_reviewer_access" ON public.approval_steps
FOR ALL USING (
  reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.approval_workflows aw
    WHERE aw.id = approval_steps.workflow_id
      AND aw.requested_by = auth.uid()
  )
) WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reports_access" ON public.reports
FOR ALL USING (
  user_id = auth.uid()
  OR public.current_user_is_team_member(team_id)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reports.project_id
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
) WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "scheduled_reports_access" ON public.scheduled_reports
FOR ALL USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id))
WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "cicd_integrations_access" ON public.cicd_integrations
FOR ALL USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id))
WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

-- Storage bucket used by project uploads. Bucket creation is idempotent.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_files_owner_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
);

CREATE POLICY "project_files_owner_write"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (p.user_id = auth.uid() OR public.current_user_is_team_member(p.team_id))
  )
);
