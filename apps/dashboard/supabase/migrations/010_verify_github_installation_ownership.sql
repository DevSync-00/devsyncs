ALTER TABLE public.github_app_installations
ADD COLUMN IF NOT EXISTS github_user_id bigint,
ADD COLUMN IF NOT EXISTS github_login text,
ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_github_installations_github_user
  ON public.github_app_installations(github_user_id);

-- Previous rows were created before GitHub OAuth identity binding. Keep them
-- for audit/history, but application queries now hide rows until reconnect.
