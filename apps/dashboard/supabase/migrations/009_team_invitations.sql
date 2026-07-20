CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (NOW() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id
  ON public.team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
  ON public.team_invitations(lower(email));

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_invitations_team_admin_access"
  ON public.team_invitations;

CREATE POLICY "team_invitations_team_admin_access"
ON public.team_invitations
FOR ALL
USING (
  invited_by = auth.uid()
  OR public.check_team_admin_role(team_id)
)
WITH CHECK (
  invited_by = auth.uid()
  AND public.check_team_admin_role(team_id)
);
