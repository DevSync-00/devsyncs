-- DevSync compatibility patch for existing Supabase projects.
--
-- Run this BEFORE 001_core_schema.sql when your database already contains
-- older DevSync tables. CREATE TABLE IF NOT EXISTS does not add columns to
-- existing tables, so this patch backfills the columns that 001 expects.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables: add columns used by 001 policies/routes if older tables exist.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.teams') IS NOT NULL THEN
    ALTER TABLE public.teams
      ADD COLUMN IF NOT EXISTS slug text,
      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

    UPDATE public.teams
    SET slug = lower(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
    WHERE slug IS NULL;

    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS slug_rank
      FROM public.teams
    )
    UPDATE public.teams t
    SET slug = concat(t.slug, '-', left(t.id::text, 8))
    FROM ranked r
    WHERE r.id = t.id
      AND r.slug_rank > 1;

    ALTER TABLE public.teams
      ALTER COLUMN slug SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_unique ON public.teams(slug);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.team_members') IS NOT NULL THEN
    ALTER TABLE public.team_members
      ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS slug text,
      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS schema_type text NOT NULL DEFAULT 'prisma',
      ADD COLUMN IF NOT EXISTS db_connection_string text,
      ADD COLUMN IF NOT EXISTS db_secret_id uuid,
      ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

    UPDATE public.projects
    SET slug = lower(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
    WHERE slug IS NULL;

    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (PARTITION BY user_id, slug ORDER BY created_at NULLS LAST, id) AS slug_rank
      FROM public.projects
    )
    UPDATE public.projects p
    SET slug = concat(p.slug, '-', left(p.id::text, 8))
    FROM ranked r
    WHERE r.id = p.id
      AND r.slug_rank > 1;

    ALTER TABLE public.projects
      ALTER COLUMN slug SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_unique ON public.projects(user_id, slug);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.scan_reports') IS NOT NULL THEN
    ALTER TABLE public.scan_reports
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS mismatches jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS code_schema jsonb,
      ADD COLUMN IF NOT EXISTS db_schema jsonb,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS error_message text,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS completed_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.migrations') IS NOT NULL THEN
    ALTER TABLE public.migrations
      ADD COLUMN IF NOT EXISTS scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS filename text,
      ADD COLUMN IF NOT EXISTS name text,
      ADD COLUMN IF NOT EXISTS content text,
      ADD COLUMN IF NOT EXISTS rollback_content text,
      ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'sql',
      ADD COLUMN IF NOT EXISTS safety_score numeric(5,2),
      ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS applied_at timestamptz,
      ADD COLUMN IF NOT EXISTS applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS execution_started_at timestamptz,
      ADD COLUMN IF NOT EXISTS execution_completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS execution_error text,
      ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- These tables may not exist yet in older installs; create minimal-compatible
-- versions so the main 001 migration can continue idempotently.
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

DO $$
BEGIN
  IF to_regclass('public.migrations') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS public.migration_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      migration_id uuid REFERENCES public.migrations(id) ON DELETE CASCADE,
      executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      execution_type text NOT NULL DEFAULT 'apply',
      status text NOT NULL DEFAULT 'running',
      sql_executed text,
      error_message text,
      affected_rows integer NOT NULL DEFAULT 0,
      execution_time_ms integer,
      started_at timestamptz NOT NULL DEFAULT NOW(),
      completed_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helper functions needed by policies.
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
