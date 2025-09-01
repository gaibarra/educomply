-- 2025-08-14_task_activity_log.sql
-- Crea tabla de log de actividad y triggers para registrar cambios de estado y eventos relevantes.

-- 1) Tabla de actividad
CREATE TABLE IF NOT EXISTS public.task_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    sub_task_id uuid NULL REFERENCES public.sub_tasks(id) ON DELETE CASCADE,
    actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name text NULL,
    event_type text NOT NULL,
    from_status text NULL,
    to_status text NULL,
    detail text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity_log(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_activity_type ON public.task_activity_log(event_type);

-- 2) Función helper para insertar log genérico
CREATE OR REPLACE FUNCTION public._log_task_activity(
    p_task_id uuid,
    p_sub_task_id uuid,
    p_event_type text,
    p_from text,
    p_to text,
    p_detail text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.task_activity_log(task_id, sub_task_id, event_type, from_status, to_status, detail, actor_id, actor_name)
  VALUES (p_task_id, p_sub_task_id, p_event_type, p_from, p_to, p_detail, auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()));
END;$$;

GRANT EXECUTE ON FUNCTION public._log_task_activity(uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._log_task_activity(uuid,uuid,text,text,text,text) TO service_role;

-- 3) Trigger: creación de sub_tarea
CREATE OR REPLACE FUNCTION public._log_sub_task_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._log_task_activity(NEW.task_id, NEW.id, 'subtask_created', NULL, NEW.status::text, left(NEW.description,500));
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_log_sub_task_insert ON public.sub_tasks;
CREATE TRIGGER trg_log_sub_task_insert AFTER INSERT ON public.sub_tasks
FOR EACH ROW EXECUTE FUNCTION public._log_sub_task_insert();

-- 4) Trigger: cambio de estado sub_tarea
CREATE OR REPLACE FUNCTION public._log_sub_task_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._log_task_activity(NEW.task_id, NEW.id, 'subtask_status_change', OLD.status::text, NEW.status::text, left(NEW.description,500));
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_log_sub_task_update ON public.sub_tasks;
CREATE TRIGGER trg_log_sub_task_update AFTER UPDATE ON public.sub_tasks
FOR EACH ROW EXECUTE FUNCTION public._log_sub_task_update();

-- 5) Triggers para comentarios y documentos
CREATE OR REPLACE FUNCTION public._log_comment_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE task_uuid uuid; BEGIN
  SELECT task_id INTO task_uuid FROM public.sub_tasks WHERE id = NEW.sub_task_id;
  PERFORM public._log_task_activity(task_uuid, NEW.sub_task_id, 'comment_added', NULL, NULL, left(NEW.text, 600));
  RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_log_comment_insert ON public.comments;
CREATE TRIGGER trg_log_comment_insert AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public._log_comment_insert();

CREATE OR REPLACE FUNCTION public._log_document_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE task_uuid uuid; BEGIN
  task_uuid := NEW.task_id; -- Directly use task_id from the new document
  PERFORM public._log_task_activity(task_uuid, NULL, 'document_attached', NULL, NULL, left(NEW.filename, 300)); -- Use NEW.filename and set sub_task_id to NULL
  RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_log_document_insert ON public.documents;
CREATE TRIGGER trg_log_document_insert AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public._log_document_insert();

-- 6) Reemplazar funciones RPC para loggear eventos de completado/reapertura
DROP FUNCTION IF EXISTS public.mark_task_completed(uuid);
CREATE OR REPLACE FUNCTION public.mark_task_completed(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE sub_tasks SET status = 'Completada', updated_at = now() WHERE task_id = mark_task_completed.p_task_id;
  IF NOT FOUND THEN
    INSERT INTO sub_tasks (id, task_id, title, status, created_at) VALUES (gen_random_uuid(), mark_task_completed.p_task_id, 'Marcado como cumplido', 'Completada', now());
  END IF;
  UPDATE tasks SET completed_by = auth.uid(), completed_at = now() WHERE id = mark_task_completed.p_task_id;
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_completed', NULL, 'Completada', 'Tarea marcada como completada');
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.reopen_task(uuid);
CREATE OR REPLACE FUNCTION public.reopen_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE sub_tasks SET status = 'Pendiente', updated_at = now() WHERE task_id = reopen_task.p_task_id;
  UPDATE tasks SET completed_by = NULL, completed_at = NULL WHERE id = reopen_task.p_task_id;
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_reopened', 'Completada', 'Pendiente', 'Tarea reabierta');
END; $$;
GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO service_role;

-- 7) Notificar reload a PostgREST
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN others THEN NULL; END $$;