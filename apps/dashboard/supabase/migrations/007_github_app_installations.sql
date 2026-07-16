-- GitHub App installations connected by individual DevSync users.
-- No GitHub access token is persisted; installation tokens are minted on demand.

CREATE TABLE IF NOT EXISTS public.github_app_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL,
  account_login text NOT NULL,
  account_type text NOT NULL DEFAULT 'User',
  repository_selection text NOT NULL DEFAULT 'selected',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_github_installations_user
  ON public.github_app_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_github_installations_account
  ON public.github_app_installations(lower(account_login));

ALTER TABLE public.github_app_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "github_installations_user_access"
  ON public.github_app_installations;
CREATE POLICY "github_installations_user_access"
  ON public.github_app_installations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

