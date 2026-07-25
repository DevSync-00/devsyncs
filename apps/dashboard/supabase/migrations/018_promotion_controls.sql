-- Risk-based approval quorum and controlled execution evidence.

ALTER TABLE public.deployment_promotions
  ADD COLUMN IF NOT EXISTS required_approvals integer NOT NULL DEFAULT 0 CHECK (required_approvals BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS separation_of_duties boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_text text,
  ADD COLUMN IF NOT EXISTS execution_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS public.promotion_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.deployment_promotions(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'approved' CHECK (decision IN ('approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(promotion_id, approver_id)
);

ALTER TABLE public.promotion_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotion_approvals_access ON public.promotion_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.deployment_promotions dp
      WHERE dp.id = promotion_id AND public.current_user_can_access_project(dp.project_id)
    )
  );
CREATE POLICY promotion_approvals_insert ON public.promotion_approvals
  FOR INSERT WITH CHECK (
    approver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.deployment_promotions dp
      WHERE dp.id = promotion_id AND public.current_user_can_access_project(dp.project_id)
    )
  );
REVOKE UPDATE, DELETE ON public.promotion_approvals FROM authenticated, anon;

COMMENT ON TABLE public.promotion_approvals IS
  'Append-only individual votes used to satisfy risk-derived promotion approval quorum.';
