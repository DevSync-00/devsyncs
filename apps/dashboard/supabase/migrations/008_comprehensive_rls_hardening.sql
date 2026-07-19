-- Comprehensive RLS hardening for DevSync application tables.
--
-- This replaces older partial/core-only policies with a consistent ownership
-- model:
-- - user-owned rows are visible only to that user
-- - team-scoped rows are visible to team members
-- - project-scoped rows inherit access from their project
-- - server-only/auth-code tables remain service-role only

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_user_is_team_member(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = team_uuid
        AND tm.user_id = auth.uid()
    ),
    false
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

CREATE OR REPLACE FUNCTION public.check_team_admin_role(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = team_uuid
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_project(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_uuid
        AND (
          p.user_id = auth.uid()
          OR public.current_user_is_team_member(p.team_id)
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_scan_report(scan_report_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.scan_reports sr
      WHERE sr.id = scan_report_uuid
        AND public.current_user_can_access_project(sr.project_id)
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_migration(migration_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.migrations m
      WHERE m.id = migration_uuid
        AND public.current_user_can_access_scan_report(m.scan_report_id)
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.set_team_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_created_by ON public.teams;
CREATE TRIGGER set_team_created_by
BEFORE INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_team_created_by();

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
        'schema_snapshots',
        'scan_reports',
        'migrations',
        'migration_history',
        'schema_drift_metrics',
        'migration_metrics',
        'team_activity_metrics',
        'schema_stability_scores',
        'frequently_changing_objects',
        'device_auth_codes',
        'shared_scan_results',
        'mismatch_comments',
        'change_requests',
        'approval_workflows',
        'approval_steps',
        'activity_feed',
        'notifications',
        'notification_preferences',
        'reports',
        'report_templates',
        'scheduled_reports',
        'cicd_integrations',
        'api_keys',
        'github_app_installations',
        'profiles',
        'users'
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
ALTER TABLE public.schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_drift_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_stability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequently_changing_objects ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.github_app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_member_select"
ON public.teams FOR SELECT
USING (created_by = auth.uid() OR public.current_user_is_team_member(id));

CREATE POLICY "teams_authenticated_insert"
ON public.teams FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_admin_update"
ON public.teams FOR UPDATE
USING (created_by = auth.uid() OR public.check_team_admin_role(id))
WITH CHECK (created_by = auth.uid() OR public.check_team_admin_role(id));

CREATE POLICY "teams_owner_delete"
ON public.teams FOR DELETE
USING (created_by = auth.uid() OR public.check_team_admin_role(id));

CREATE POLICY "team_members_team_select"
ON public.team_members FOR SELECT
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "team_members_self_or_admin_insert"
ON public.team_members FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.check_team_admin_role(team_id));

CREATE POLICY "team_members_admin_update"
ON public.team_members FOR UPDATE
USING (public.check_team_admin_role(team_id))
WITH CHECK (public.check_team_admin_role(team_id));

CREATE POLICY "team_members_self_or_admin_delete"
ON public.team_members FOR DELETE
USING (user_id = auth.uid() OR public.check_team_admin_role(team_id));

CREATE POLICY "projects_access"
ON public.projects FOR ALL
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id))
WITH CHECK (user_id = auth.uid() OR public.current_user_is_team_member(team_id));

CREATE POLICY "scan_reports_project_access"
ON public.scan_reports FOR ALL
USING (public.current_user_can_access_project(project_id))
WITH CHECK (public.current_user_can_access_project(project_id));

CREATE POLICY "schema_snapshots_project_access"
ON public.schema_snapshots FOR ALL
USING (public.current_user_can_access_project(project_id))
WITH CHECK (public.current_user_can_access_project(project_id) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "migrations_scan_report_access"
ON public.migrations FOR ALL
USING (public.current_user_can_access_scan_report(scan_report_id))
WITH CHECK (public.current_user_can_access_scan_report(scan_report_id));

CREATE POLICY "migration_history_migration_access"
ON public.migration_history FOR ALL
USING (public.current_user_can_access_migration(migration_id))
WITH CHECK (public.current_user_can_access_migration(migration_id) AND (executed_by IS NULL OR executed_by = auth.uid()));

CREATE POLICY "schema_drift_metrics_project_access"
ON public.schema_drift_metrics FOR SELECT
USING (public.current_user_can_access_project(project_id));

CREATE POLICY "migration_metrics_project_access"
ON public.migration_metrics FOR SELECT
USING (public.current_user_can_access_project(project_id));

CREATE POLICY "team_activity_metrics_access"
ON public.team_activity_metrics FOR SELECT
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id) OR public.current_user_can_access_project(project_id));

CREATE POLICY "schema_stability_scores_project_access"
ON public.schema_stability_scores FOR SELECT
USING (public.current_user_can_access_project(project_id));

CREATE POLICY "frequently_changing_objects_project_access"
ON public.frequently_changing_objects FOR SELECT
USING (public.current_user_can_access_project(project_id));

CREATE POLICY "device_auth_codes_service_only"
ON public.device_auth_codes FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "shared_scan_results_project_access"
ON public.shared_scan_results FOR ALL
USING (public.current_user_can_access_scan_report(scan_report_id) OR shared_by = auth.uid())
WITH CHECK (public.current_user_can_access_scan_report(scan_report_id) AND (shared_by IS NULL OR shared_by = auth.uid()));

CREATE POLICY "mismatch_comments_project_access"
ON public.mismatch_comments FOR ALL
USING (public.current_user_can_access_scan_report(scan_report_id) OR user_id = auth.uid())
WITH CHECK (public.current_user_can_access_scan_report(scan_report_id) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "change_requests_project_access"
ON public.change_requests FOR ALL
USING (
  requested_by = auth.uid()
  OR public.current_user_can_access_scan_report(scan_report_id)
  OR public.current_user_can_access_migration(migration_id)
)
WITH CHECK (
  (requested_by IS NULL OR requested_by = auth.uid())
  AND (
    public.current_user_can_access_scan_report(scan_report_id)
    OR public.current_user_can_access_migration(migration_id)
  )
);

CREATE POLICY "approval_workflows_migration_access"
ON public.approval_workflows FOR ALL
USING (requested_by = auth.uid() OR public.current_user_can_access_migration(migration_id))
WITH CHECK (public.current_user_can_access_migration(migration_id) AND (requested_by IS NULL OR requested_by = auth.uid()));

CREATE POLICY "approval_steps_workflow_access"
ON public.approval_steps FOR ALL
USING (
  reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.approval_workflows aw
    WHERE aw.id = approval_steps.workflow_id
      AND (aw.requested_by = auth.uid() OR public.current_user_can_access_migration(aw.migration_id))
  )
)
WITH CHECK (
  reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.approval_workflows aw
    WHERE aw.id = approval_steps.workflow_id
      AND public.current_user_can_access_migration(aw.migration_id)
  )
);

CREATE POLICY "activity_feed_access"
ON public.activity_feed FOR ALL
USING (
  user_id = auth.uid()
  OR public.current_user_is_team_member(team_id)
  OR public.current_user_can_access_project(project_id)
  OR public.current_user_can_access_scan_report(scan_report_id)
  OR public.current_user_can_access_migration(migration_id)
)
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND (
    team_id IS NULL OR public.current_user_is_team_member(team_id)
  )
  AND (
    project_id IS NULL OR public.current_user_can_access_project(project_id)
  )
);

CREATE POLICY "notifications_user_access"
ON public.notifications FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_user_access"
ON public.notification_preferences FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reports_access"
ON public.reports FOR ALL
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id) OR public.current_user_can_access_project(project_id))
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND (team_id IS NULL OR public.current_user_is_team_member(team_id))
  AND (project_id IS NULL OR public.current_user_can_access_project(project_id))
);

CREATE POLICY "report_templates_select"
ON public.report_templates FOR SELECT
USING (is_system OR user_id = auth.uid());

CREATE POLICY "report_templates_user_insert"
ON public.report_templates FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "report_templates_user_update"
ON public.report_templates FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "report_templates_user_delete"
ON public.report_templates FOR DELETE
USING (user_id = auth.uid() AND is_system = false);

CREATE POLICY "scheduled_reports_access"
ON public.scheduled_reports FOR ALL
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id) OR public.current_user_can_access_project(project_id))
WITH CHECK (
  user_id = auth.uid()
  AND (team_id IS NULL OR public.current_user_is_team_member(team_id))
  AND (project_id IS NULL OR public.current_user_can_access_project(project_id))
);

CREATE POLICY "cicd_integrations_access"
ON public.cicd_integrations FOR ALL
USING (user_id = auth.uid() OR public.current_user_is_team_member(team_id) OR public.current_user_can_access_project(project_id))
WITH CHECK (
  user_id = auth.uid()
  AND (team_id IS NULL OR public.current_user_is_team_member(team_id))
  AND (project_id IS NULL OR public.current_user_can_access_project(project_id))
);

CREATE POLICY "api_keys_user_access"
ON public.api_keys FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "github_app_installations_user_access"
ON public.github_app_installations FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_self_access"
ON public.profiles FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users_service_only"
ON public.users FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
