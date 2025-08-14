-- 2025-08-14_tasks_completion_metadata.sql
-- Adds completion metadata fields to tasks and updates RPC functions to maintain them.

-- 1) Columns (idempotent)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

-- Optional indexes if you will query frequently by these fields
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON public.tasks(completed_by);

-- 2) Recreate mark_task_completed to also stamp completion metadata
--    Problem: existing function may have different parameter name (task_id vs p_task_id). We drop it first to avoid 42P13 error.
DROP FUNCTION IF EXISTS public.mark_task_completed(uuid);
CREATE OR REPLACE FUNCTION public.mark_task_completed(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark existing sub_tasks
  UPDATE sub_tasks
     SET status = 'Completada', updated_at = now()
   WHERE task_id = mark_task_completed.p_task_id;

  IF NOT FOUND THEN
    -- Insert minimal sub_task if none existed so UI shows a completed trace
    INSERT INTO sub_tasks (id, task_id, title, status, created_at)
    VALUES (gen_random_uuid(), mark_task_completed.p_task_id, 'Marcado como cumplido', 'Completada', now());
  END IF;

  -- Stamp completion metadata on parent task
  UPDATE tasks
     SET completed_by = auth.uid(),
         completed_at = now()
   WHERE id = mark_task_completed.p_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO service_role;

-- 3) Recreate reopen_task to clear metadata
DROP FUNCTION IF EXISTS public.reopen_task(uuid);
CREATE OR REPLACE FUNCTION public.reopen_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sub_tasks
     SET status = 'Pendiente', updated_at = now()
   WHERE task_id = reopen_task.p_task_id;

  -- Clear completion metadata
  UPDATE tasks
     SET completed_by = NULL,
         completed_at = NULL
   WHERE id = reopen_task.p_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO service_role;

-- 4) (Optional) Backfill: mark tasks without pending sub_tasks as completed (without actor info)
-- Uncomment if you want to initialize completed_at for already-completed tasks.
-- UPDATE public.tasks t
--   SET completed_at = COALESCE(completed_at, now())
-- WHERE completed_at IS NULL
--   AND NOT EXISTS (
--         SELECT 1 FROM public.sub_tasks s
--          WHERE s.task_id = t.id AND s.status <> 'Completada'
--       );

-- 5) Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
