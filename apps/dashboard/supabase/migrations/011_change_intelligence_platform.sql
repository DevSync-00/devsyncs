-- DevSync application-aware change intelligence.
-- Additive only: existing projects, scans, migrations, and clients remain valid.

CREATE TABLE IF NOT EXISTS public.project_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  tier text NOT NULL DEFAULT 'development'
    CHECK (tier IN ('local', 'preview', 'development', 'staging', 'production')),
  position integer NOT NULL DEFAULT 0,
  connection_secret_id uuid,
  schema_fingerprint text,
  current_scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'healthy', 'drifted', 'deploying', 'failed')),
  protected boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, slug)
);

CREATE TABLE IF NOT EXISTS public.application_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_type text NOT NULL
    CHECK (resource_type IN ('table', 'column', 'file', 'api', 'job', 'service')),
  resource_key text NOT NULL,
  owner_type text NOT NULL DEFAULT 'team'
    CHECK (owner_type IN ('user', 'team', 'codeowners', 'external')),
  owner_key text NOT NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'codeowners', 'inferred', 'api')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, resource_type, resource_key, owner_key)
);

CREATE TABLE IF NOT EXISTS public.change_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  scope jsonb NOT NULL DEFAULT '{}',
  rules jsonb NOT NULL DEFAULT '[]',
  enforcement text NOT NULL DEFAULT 'warn'
    CHECK (enforcement IN ('observe', 'warn', 'block')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (project_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.policy_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.change_policies(id) ON DELETE CASCADE,
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE CASCADE,
  migration_id uuid REFERENCES public.migrations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('passed', 'warned', 'blocked', 'error')),
  evidence jsonb NOT NULL DEFAULT '[]',
  evaluated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (scan_report_id IS NOT NULL OR migration_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.migration_rehearsals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES public.migrations(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.project_environments(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'provisioning', 'running', 'passed', 'failed', 'cancelled')),
  strategy text NOT NULL DEFAULT 'schema-only'
    CHECK (strategy IN ('schema-only', 'sampled-data', 'production-shaped')),
  started_at timestamptz,
  completed_at timestamptz,
  execution_time_ms integer,
  rollback_status text CHECK (rollback_status IN ('not_tested', 'passed', 'failed')),
  lock_estimates jsonb NOT NULL DEFAULT '[]',
  query_results jsonb NOT NULL DEFAULT '[]',
  test_results jsonb NOT NULL DEFAULT '[]',
  evidence jsonb NOT NULL DEFAULT '[]',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.query_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.project_environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  query_hash text NOT NULL,
  normalized_query text,
  source_file text,
  source_line integer,
  p50_ms numeric,
  p95_ms numeric,
  calls_per_minute numeric,
  rows_average numeric,
  metadata jsonb NOT NULL DEFAULT '{}',
  captured_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, environment_id, query_hash)
);

CREATE TABLE IF NOT EXISTS public.pull_request_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github' CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  repository text NOT NULL,
  pull_request_number integer NOT NULL,
  head_sha text NOT NULL,
  base_sha text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'changes_requested', 'failed', 'superseded')),
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
  summary jsonb NOT NULL DEFAULT '{}',
  check_run_id text,
  comment_id text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(provider, repository, pull_request_number, head_sha)
);

CREATE TABLE IF NOT EXISTS public.ai_change_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scan_report_id uuid REFERENCES public.scan_reports(id) ON DELETE SET NULL,
  migration_id uuid REFERENCES public.migrations(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'approved', 'rejected', 'executed')),
  plan jsonb NOT NULL DEFAULT '[]',
  evidence jsonb NOT NULL DEFAULT '[]',
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
  model_provider text,
  model_name text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_environments_project ON public.project_environments(project_id, position);
CREATE INDEX IF NOT EXISTS idx_ownership_project_resource ON public.application_ownership(project_id, resource_type, resource_key);
CREATE INDEX IF NOT EXISTS idx_change_policies_project ON public.change_policies(project_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_change_policies_team ON public.change_policies(team_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_rehearsals_migration ON public.migration_rehearsals(migration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_baselines_project ON public.query_baselines(project_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_project ON public.pull_request_reviews(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_change_plans_project ON public.ai_change_plans(project_id, created_at DESC);

DROP TRIGGER IF EXISTS set_project_environments_updated_at ON public.project_environments;
CREATE TRIGGER set_project_environments_updated_at
  BEFORE UPDATE ON public.project_environments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_application_ownership_updated_at ON public.application_ownership;
CREATE TRIGGER set_application_ownership_updated_at
  BEFORE UPDATE ON public.application_ownership
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_change_policies_updated_at ON public.change_policies;
CREATE TRIGGER set_change_policies_updated_at
  BEFORE UPDATE ON public.change_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_pull_request_reviews_updated_at ON public.pull_request_reviews;
CREATE TRIGGER set_pull_request_reviews_updated_at
  BEFORE UPDATE ON public.pull_request_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_change_plans_updated_at ON public.ai_change_plans;
CREATE TRIGGER set_ai_change_plans_updated_at
  BEFORE UPDATE ON public.ai_change_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_request_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_change_plans ENABLE ROW LEVEL SECURITY;

-- Reuse project visibility rules without recursive team-member joins.
CREATE POLICY project_environments_access ON public.project_environments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY application_ownership_access ON public.application_ownership
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY change_policies_access ON public.change_policies
  FOR ALL USING (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    ))
    OR (team_id IS NOT NULL AND public.check_team_membership(team_id))
  ) WITH CHECK (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    ))
    OR (team_id IS NOT NULL AND public.check_team_membership(team_id))
  );

-- Child records inherit visibility through their parent project/migration/report.
CREATE POLICY policy_evaluations_access ON public.policy_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.change_policies cp
      WHERE cp.id = policy_id AND (
        (cp.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects p WHERE p.id = cp.project_id
            AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
        ))
        OR (cp.team_id IS NOT NULL AND public.check_team_membership(cp.team_id))
      )
    )
  );

CREATE POLICY migration_rehearsals_access ON public.migration_rehearsals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.migrations m
      JOIN public.scan_reports sr ON sr.id = m.scan_report_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE m.id = migration_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.migrations m
      JOIN public.scan_reports sr ON sr.id = m.scan_report_id
      JOIN public.projects p ON p.id = sr.project_id
      WHERE m.id = migration_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY query_baselines_access ON public.query_baselines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY pull_request_reviews_access ON public.pull_request_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY ai_change_plans_access ON public.ai_change_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

