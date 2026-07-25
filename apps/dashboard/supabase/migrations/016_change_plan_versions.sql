-- Immutable, evidence-cited change-plan versions.

CREATE TABLE IF NOT EXISTS public.ai_change_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.ai_change_plans(id) ON DELETE CASCADE,
  version integer NOT NULL,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'superseded')),
  steps jsonb NOT NULL DEFAULT '[]',
  citations jsonb NOT NULL DEFAULT '[]',
  patch_proposals jsonb NOT NULL DEFAULT '[]',
  test_proposals jsonb NOT NULL DEFAULT '[]',
  assumptions jsonb NOT NULL DEFAULT '[]',
  unresolved_questions jsonb NOT NULL DEFAULT '[]',
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  risk_score integer NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  safety_snapshot jsonb NOT NULL DEFAULT '{}',
  content_hash text NOT NULL,
  generated_by text NOT NULL DEFAULT 'deterministic'
    CHECK (generated_by IN ('deterministic', 'ai-enriched')),
  model_provider text,
  model_name text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, version),
  UNIQUE(plan_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_change_plan_versions_plan
  ON public.ai_change_plan_versions(plan_id, version DESC);

ALTER TABLE public.ai_change_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY change_plan_versions_access ON public.ai_change_plan_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_change_plans cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.id = plan_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY change_plan_versions_insert ON public.ai_change_plan_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_change_plans cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.id = plan_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE OR REPLACE FUNCTION public.protect_change_plan_version()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'proposed'
     AND NEW.status IN ('approved', 'rejected', 'superseded')
     AND NEW.steps = OLD.steps
     AND NEW.citations = OLD.citations
     AND NEW.patch_proposals = OLD.patch_proposals
     AND NEW.test_proposals = OLD.test_proposals
     AND NEW.content_hash = OLD.content_hash THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'change plan version content is immutable';
END;
$$;

DROP TRIGGER IF EXISTS protect_change_plan_version_update ON public.ai_change_plan_versions;
CREATE TRIGGER protect_change_plan_version_update
  BEFORE UPDATE ON public.ai_change_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.protect_change_plan_version();
