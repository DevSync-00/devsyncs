-- Fix infinite recursion in team_members RLS policy
-- Run this in your Supabase SQL Editor

-- Step 1: Create or replace the RPC function with SECURITY DEFINER to bypass RLS
-- This function runs with elevated privileges and bypasses RLS entirely
-- IMPORTANT: We explicitly disable RLS within the function to prevent recursion
CREATE OR REPLACE FUNCTION check_team_membership(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_member BOOLEAN;
  old_row_security TEXT;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- If no user, return false
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Temporarily disable RLS for this session to prevent recursion
  -- SECURITY DEFINER already runs with elevated privileges, but we need
  -- to explicitly turn off RLS to prevent policy evaluation
  SELECT current_setting('row_security', true) INTO old_row_security;
  PERFORM set_config('row_security', 'off', true);
  
  -- Check membership directly (RLS is now disabled)
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = team_uuid
      AND user_id = current_user_id
  ) INTO is_member;
  
  -- Restore original RLS setting
  PERFORM set_config('row_security', COALESCE(old_row_security, 'on'), true);
  
  RETURN is_member;
END;
$$;

-- Step 2: Create helper function for checking admin role (needed before policies)
-- This function runs with elevated privileges and explicitly disables RLS
CREATE OR REPLACE FUNCTION check_team_admin_role(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
  old_row_security TEXT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Temporarily disable RLS to prevent recursion
  SELECT current_setting('row_security', true) INTO old_row_security;
  PERFORM set_config('row_security', 'off', true);
  
  -- Get user's role in the team (RLS is now disabled)
  SELECT role INTO user_role
  FROM public.team_members
  WHERE team_id = team_uuid
    AND user_id = current_user_id
  LIMIT 1;
  
  -- Restore original RLS setting
  PERFORM set_config('row_security', COALESCE(old_row_security, 'on'), true);
  
  RETURN COALESCE(user_role IN ('owner', 'admin'), FALSE);
END;
$$;

-- Step 3: Drop existing problematic policies on team_members (if they exist)
-- Adjust these policy names based on what you have in your Supabase dashboard
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Users can view own team memberships" ON team_members;
DROP POLICY IF EXISTS "Team members can view team" ON team_members;
DROP POLICY IF EXISTS "Users can insert team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete members" ON team_members;

-- Step 4: Create simple, non-recursive RLS policies for team_members
-- CRITICAL FIX: The SELECT policy CANNOT use check_team_membership() because it queries
-- the same table, causing infinite recursion. Even with SECURITY DEFINER and RLS disabled,
-- Supabase may still evaluate policies recursively.
-- 
-- SOLUTION: Only allow users to see their own memberships via RLS policy.
-- For viewing other team members, the application code should use the RPC function
-- check_team_membership() directly, which bypasses RLS.

-- Policy: Users can view their own team memberships (no recursion possible)
-- This is the ONLY SELECT policy - it's simple and cannot recurse
CREATE POLICY "Users can view own team memberships"
  ON team_members
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- NOTE: We do NOT create a policy to view other team members via RLS.
-- Instead, application code should:
-- 1. Use the RPC function check_team_membership() to verify access
-- 2. Then query team_members directly (which will only return own memberships via RLS)
-- 3. Or use a service role client that bypasses RLS for admin operations

-- Policy: Users can insert themselves as team members (if invited)
-- Or restrict this to team owners/admins only
CREATE POLICY "Users can insert team members"
  ON team_members
  FOR INSERT
  WITH CHECK (
    -- Only allow if user is already a team owner/admin (uses RPC to avoid recursion)
    check_team_admin_role(team_id) = TRUE
    -- OR if the user is inserting themselves (for self-join scenarios)
    OR user_id = auth.uid()
  );

-- Policy: Only team owners/admins can update team members
CREATE POLICY "Team admins can update members"
  ON team_members
  FOR UPDATE
  USING (
    check_team_admin_role(team_id) = TRUE
  );

-- Policy: Only team owners/admins can delete team members
CREATE POLICY "Team admins can delete members"
  ON team_members
  FOR DELETE
  USING (
    check_team_admin_role(team_id) = TRUE
  );

-- Step 5: Ensure RLS is enabled on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Step 6: Fix projects table policies to use RPC function (prevents recursion)
-- Drop existing problematic policies on projects
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can view team projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- Policy: Users can view projects they own or are team members of
-- IMPORTANT: Uses RPC function to avoid recursion
CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND check_team_membership(team_id) = TRUE)
  );

-- Policy: Users can create projects (own or for teams they're members of)
CREATE POLICY "Users can create own projects"
  ON projects
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    (team_id IS NULL OR check_team_membership(team_id) = TRUE)
  );

-- Policy: Users can update projects they own or are team admins of
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND check_team_admin_role(team_id) = TRUE)
  );

-- Policy: Users can delete projects they own or are team admins of
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND check_team_admin_role(team_id) = TRUE)
  );

-- Step 7: Fix scan_reports table policies (if they also query team_members)
DROP POLICY IF EXISTS "Users can view project scan reports" ON scan_reports;
DROP POLICY IF EXISTS "Users can create scan reports" ON scan_reports;

-- Policy: Users can view scan reports for projects they own or are team members of
CREATE POLICY "Users can view project scan reports"
  ON scan_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = scan_reports.project_id
      AND (
        p.user_id = auth.uid() OR
        (p.team_id IS NOT NULL AND check_team_membership(p.team_id) = TRUE)
      )
    )
  );

-- Policy: Users can create scan reports for projects they own or are team members of
CREATE POLICY "Users can create scan reports"
  ON scan_reports
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = scan_reports.project_id
      AND (
        p.user_id = auth.uid() OR
        (p.team_id IS NOT NULL AND check_team_membership(p.team_id) = TRUE)
      )
    )
  );

-- Verify the functions work
-- SELECT check_team_membership('your-team-uuid-here');
-- SELECT check_team_admin_role('your-team-uuid-here');
