-- Emergency RLS reset for DevSync core tables.
--
-- Use this when older/partial policy runs left recursive policies in Supabase.
-- It drops all policies on the core dashboard tables and recreates a minimal
-- owner-only policy set. This is intentionally conservative: team-wide access
-- can be reintroduced later through audited RPC/server routes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'teams',
        'team_members',
        'projects',
        'scan_reports',
        'migrations',
        'migration_history',
        'device_auth_codes',
        'notifications',
        'notification_preferences',
        'api_keys'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Teams: owner/admin managed, no recursive team member expansion.
CREATE POLICY "teams_owner_select"
ON public.teams
FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "teams_owner_insert"
ON public.teams
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_owner_update"
ON public.teams
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_owner_delete"
ON public.teams
FOR DELETE
USING (created_by = auth.uid());

-- Team memberships: users can see their own membership rows only.
CREATE POLICY "team_members_self_select"
ON public.team_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "team_members_self_insert"
ON public.team_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_members_self_delete"
ON public.team_members
FOR DELETE
USING (user_id = auth.uid());

-- Projects: owner-only. This is what the dashboard currently queries.
CREATE POLICY "projects_owner_select"
ON public.projects
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "projects_owner_insert"
ON public.projects
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_owner_update"
ON public.projects
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_owner_delete"
ON public.projects
FOR DELETE
USING (user_id = auth.uid());

-- Scan reports belong to projects; access follows project ownership.
CREATE POLICY "scan_reports_owner_select"
ON public.scan_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "scan_reports_owner_insert"
ON public.scan_reports
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "scan_reports_owner_update"
ON public.scan_reports
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "scan_reports_owner_delete"
ON public.scan_reports
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = scan_reports.project_id
      AND p.user_id = auth.uid()
  )
);

-- Migrations belong to scan reports; access follows project ownership.
CREATE POLICY "migrations_owner_access"
ON public.migrations
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = migrations.scan_report_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.scan_reports sr
    JOIN public.projects p ON p.id = sr.project_id
    WHERE sr.id = migrations.scan_report_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "migration_history_owner_select"
ON public.migration_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.migrations m
    JOIN public.scan_reports sr ON sr.id = m.scan_report_id
    JOIN public.projects p ON p.id = sr.project_id
    WHERE m.id = migration_history.migration_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "migration_history_owner_insert"
ON public.migration_history
FOR INSERT
WITH CHECK (executed_by = auth.uid());

-- Device auth is server-managed.
CREATE POLICY "device_auth_service_only"
ON public.device_auth_codes
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Simple user-owned support tables.
CREATE POLICY "notifications_user_access"
ON public.notifications
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_user_access"
ON public.notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_user_access"
ON public.api_keys
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
