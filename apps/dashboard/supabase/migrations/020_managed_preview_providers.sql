-- Managed preview provider lifecycle and encrypted management credentials.

ALTER TABLE public.environment_secrets
  ADD COLUMN IF NOT EXISTS encrypted_management_value text,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'ready'
    CHECK (lifecycle_status IN ('provisioning', 'ready', 'resetting', 'failed', 'deleting', 'deleted')),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_environment_secrets_lifecycle
  ON public.environment_secrets(lifecycle_status, expires_at)
  WHERE provider <> 'postgres-transaction';
