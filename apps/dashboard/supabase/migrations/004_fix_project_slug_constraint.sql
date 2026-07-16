-- Fix legacy global project slug uniqueness.
--
-- DevSync projects should be unique per user, not globally unique by slug.
-- Older schemas may have created public.projects.slug as UNIQUE, producing a
-- constraint named projects_slug_key that blocks common names like "test".

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_slug_key;

DROP INDEX IF EXISTS public.projects_slug_key;
DROP INDEX IF EXISTS public.projects_slug_unique;

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_unique
ON public.projects(user_id, slug);
