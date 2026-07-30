-- Migration: Create project_layouts table for visualizer coordinate persistence
CREATE TABLE IF NOT EXISTS public.project_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  layout_data JSONB NOT NULL, -- Map of table names to {x, y} coordinates
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.project_layouts ENABLE ROW LEVEL SECURITY;

-- Create unified security policy for team/owner access
CREATE POLICY "project_layouts_access" 
  ON public.project_layouts FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
      UNION
      SELECT project_id FROM public.team_members tm 
      JOIN public.projects p ON p.team_id = tm.team_id 
      WHERE tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
      UNION
      SELECT project_id FROM public.team_members tm 
      JOIN public.projects p ON p.team_id = tm.team_id 
      WHERE tm.user_id = auth.uid()
    )
  );
