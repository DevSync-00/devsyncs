-- Gated environment promotions. Planning and approval are separate from
-- execution so no API call can silently modify a target database.

CREATE TABLE IF NOT EXISTS public.deployment_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  migration_id uuid NOT NULL REFERENCES public.migrations(id) ON DELETE CASCADE,
  source_environment_id uuid REFERENCES public.project_environments(id) ON DELETE SET NULL,
  target_environment_id uuid NOT NULL REFERENCES public.project_environments(id) ON DELETE CASCADE,
  rehearsal_id uuid REFERENCES public.migration_rehearsals(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'blocked', 'awaiting_approval', 'approved',
      'deploying', 'deployed', 'failed', 'cancelled'
    )),
  readiness_score integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  decision text NOT NULL DEFAULT 'blocked'
    CHECK (decision IN ('blocked', 'approval_required', 'ready')),
  gates jsonb NOT NULL DEFAULT '[]',
  evidence jsonb NOT NULL DEFAULT '[]',
  execution_plan jsonb NOT NULL DEFAULT '{}',
  approved_at timestamptz,
  deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_project_created
  ON public.deployment_promotions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_target_status
  ON public.deployment_promotions(target_environment_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_promotion_per_target_migration
  ON public.deployment_promotions(migration_id, target_environment_id)
  WHERE status IN ('draft', 'awaiting_approval', 'approved', 'deploying');

DROP TRIGGER IF EXISTS set_deployment_promotions_updated_at ON public.deployment_promotions;
CREATE TRIGGER set_deployment_promotions_updated_at
  BEFORE UPDATE ON public.deployment_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deployment_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY deployment_promotions_select ON public.deployment_promotions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  );

CREATE POLICY deployment_promotions_insert ON public.deployment_promotions
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  );

CREATE POLICY deployment_promotions_update ON public.deployment_promotions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  );
