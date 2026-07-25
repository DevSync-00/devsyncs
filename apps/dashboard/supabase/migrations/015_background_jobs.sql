-- Durable background jobs with atomic leasing and retry/dead-letter support.

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('github_pr_review')),
  deduplication_key text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'retry', 'completed', 'dead', 'cancelled')),
  priority integer NOT NULL DEFAULT 100,
  payload jsonb NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,
  available_at timestamptz NOT NULL DEFAULT NOW(),
  lease_owner text,
  lease_expires_at timestamptz,
  cancel_requested boolean NOT NULL DEFAULT false,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_active_dedupe
  ON public.background_jobs(deduplication_key)
  WHERE status IN ('queued', 'running', 'retry');
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON public.background_jobs(status, available_at, priority, created_at);

DROP TRIGGER IF EXISTS set_background_jobs_updated_at ON public.background_jobs;
CREATE TRIGGER set_background_jobs_updated_at
  BEFORE UPDATE ON public.background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.background_jobs FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_background_job(worker_name text, lease_seconds integer DEFAULT 90)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE claimed_id uuid;
BEGIN
  SELECT id INTO claimed_id
  FROM public.background_jobs
  WHERE (
    (status IN ('queued', 'retry') AND available_at <= NOW())
    OR (status = 'running' AND lease_expires_at < NOW())
  )
    AND cancel_requested = false
    AND attempts < max_attempts
  ORDER BY priority ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF claimed_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  UPDATE public.background_jobs
  SET status = 'running',
      lease_owner = worker_name,
      lease_expires_at = NOW() + make_interval(secs => lease_seconds),
      attempts = attempts + 1,
      started_at = COALESCE(started_at, NOW()),
      progress = jsonb_build_object('stage', 'claimed', 'percent', 1)
  WHERE id = claimed_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_background_job(text, integer) FROM PUBLIC, authenticated, anon;
