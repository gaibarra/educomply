-- Migration: relax or remove project_id constraint from tasks
-- Choose ONE of the options below and run it in the SQL editor.

-- Option A: Simply allow NULL (recommended simplest fix)
ALTER TABLE public.tasks ALTER COLUMN project_id DROP NOT NULL;

-- Option B: (Alternative) Provide a default UUID (requires existing project table)
-- ALTER TABLE public.tasks ALTER COLUMN project_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
-- UPDATE public.tasks SET project_id = '00000000-0000-0000-0000-000000000000' WHERE project_id IS NULL;

-- Option C: Drop column entirely if you won't use it (ensure nothing depends on it)
-- ALTER TABLE public.tasks DROP COLUMN project_id;

-- After applying Option A or C, front-end inserts without project_id will succeed.
-- Re-run: SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='project_id';
