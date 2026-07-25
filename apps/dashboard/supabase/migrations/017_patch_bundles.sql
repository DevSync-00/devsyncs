-- Immutable, reviewable artifacts generated from approved change-plan versions.

CREATE TABLE IF NOT EXISTS public.change_patch_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.ai_change_plan_versions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'exported')),
  artifacts jsonb NOT NULL DEFAULT '[]',
  summary jsonb NOT NULL DEFAULT '{}',
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(plan_version_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_patch_bundles_version
  ON public.change_patch_bundles(plan_version_id, created_at DESC);

ALTER TABLE public.change_patch_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY patch_bundles_access ON public.change_patch_bundles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE POLICY patch_bundles_insert ON public.change_patch_bundles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id)))
    )
  );

CREATE OR REPLACE FUNCTION public.protect_patch_bundle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.artifacts = OLD.artifacts AND NEW.summary = OLD.summary AND NEW.content_hash = OLD.content_hash THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'patch bundle content is immutable';
END;
$$;

CREATE TRIGGER protect_patch_bundle_update
  BEFORE UPDATE ON public.change_patch_bundles
  FOR EACH ROW EXECUTE FUNCTION public.protect_patch_bundle();
