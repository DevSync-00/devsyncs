-- Durable promotion execution jobs and deployment telemetry.

ALTER TABLE public.background_jobs DROP CONSTRAINT IF EXISTS background_jobs_job_type_check;
ALTER TABLE public.background_jobs ADD CONSTRAINT background_jobs_job_type_check
  CHECK (job_type IN ('github_pr_review', 'promotion_execute'));

ALTER TABLE public.deployment_promotions DROP CONSTRAINT IF EXISTS deployment_promotions_status_check;
ALTER TABLE public.deployment_promotions ADD CONSTRAINT deployment_promotions_status_check
  CHECK (status IN (
    'draft', 'blocked', 'awaiting_approval', 'approved', 'queued',
    'deploying', 'deployed', 'failed', 'cancelled'
  ));

ALTER TABLE public.deployment_promotions
  ADD COLUMN IF NOT EXISTS execution_job_id uuid REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_metrics jsonb NOT NULL DEFAULT '{}';
