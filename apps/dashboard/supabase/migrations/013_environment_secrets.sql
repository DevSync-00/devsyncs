-- Encrypted, environment-scoped provider credentials.
-- Values are encrypted by the application before storage and are never
-- returned by public APIs.

CREATE TABLE IF NOT EXISTS public.environment_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL UNIQUE REFERENCES public.project_environments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'postgres-transaction'
    CHECK (provider IN ('postgres-transaction', 'neon-branch', 'tembo', 'custom-http')),
  encrypted_value text NOT NULL,
  encryption_version integer NOT NULL DEFAULT 1,
  connection_preview text,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_verified_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_environments
  ADD CONSTRAINT project_environments_secret_fk
  FOREIGN KEY (connection_secret_id)
  REFERENCES public.environment_secrets(id)
  ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_environment_secrets_updated_at ON public.environment_secrets;
CREATE TRIGGER set_environment_secrets_updated_at
  BEFORE UPDATE ON public.environment_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.environment_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY environment_secrets_access ON public.environment_secrets
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.project_environments pe
      JOIN public.projects p ON p.id = pe.project_id
      WHERE pe.id = environment_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.project_environments pe
      JOIN public.projects p ON p.id = pe.project_id
      WHERE pe.id = environment_id
        AND (
          p.user_id = auth.uid()
          OR (p.team_id IS NOT NULL AND public.check_team_membership(p.team_id))
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_environment_secrets_environment
  ON public.environment_secrets(environment_id);
