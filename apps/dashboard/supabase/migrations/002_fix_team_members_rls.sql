-- Fix recursive team_members RLS policies created by 001_core_schema.sql.
-- Run after 001_core_schema.sql.

CREATE OR REPLACE FUNCTION public.current_user_is_team_member(team_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  is_member boolean;
  old_row_security text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT current_setting('row_security', true) INTO old_row_security;
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = team_uuid
      AND user_id = current_user_id
  ) INTO is_member;

  PERFORM set_config('row_security', COALESCE(old_row_security, 'on'), true);

  RETURN is_member;
END;
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role text;
  old_row_security text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT current_setting('row_security', true) INTO old_row_security;
  PERFORM set_config('row_security', 'off', true);

  SELECT role INTO user_role
  FROM public.team_members
  WHERE team_id = team_uuid
    AND user_id = current_user_id
  LIMIT 1;

  PERFORM set_config('row_security', COALESCE(old_row_security, 'on'), true);

  RETURN COALESCE(user_role IN ('owner', 'admin'), false);
END;
$$;

DROP POLICY IF EXISTS "team_members_select_member" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_admin" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_admin" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_admin" ON public.team_members;
DROP POLICY IF EXISTS "Users can view own team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can delete members" ON public.team_members;

CREATE POLICY "Users can view own team memberships"
ON public.team_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert team members"
ON public.team_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.check_team_admin_role(team_id)
);

CREATE POLICY "Team admins can update members"
ON public.team_members
FOR UPDATE
USING (public.check_team_admin_role(team_id))
WITH CHECK (public.check_team_admin_role(team_id));

CREATE POLICY "Team admins can delete members"
ON public.team_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.check_team_admin_role(team_id)
);

DROP POLICY IF EXISTS "projects_member_access" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view team projects" ON public.projects;

CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own projects"
ON public.projects
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
ON public.projects
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
ON public.projects
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "scan_reports_project_access" ON public.scan_reports;
DROP POLICY IF EXISTS "Users can view project scan reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Users can create scan reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Users can update scan reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Users can delete scan reports" ON public.scan_reports;

CREATE POLICY "Users can view project scan reports"
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

CREATE POLICY "Users can create scan reports"
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
