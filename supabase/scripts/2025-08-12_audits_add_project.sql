-- Add optional project linkage to audits and index
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audits_project_id ON public.audits(project_id);

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
