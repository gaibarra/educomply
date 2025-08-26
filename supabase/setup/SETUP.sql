-- SETUP.sql
-- Script de creación idempotente para provisionar la base de datos desde cero.
-- Ejecutar en un entorno de pruebas. Diseñado para evitar errores de parches.

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Tipos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','director_campus','director_facultad','usuario');
  END IF;
END $$;

-- 2) Tablas principales
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text UNIQUE,
  role user_role DEFAULT 'usuario',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_person_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scope jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'Pendiente',
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sub_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'Pendiente',
  assigned_to_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_task_id uuid REFERENCES public.sub_tasks(id) ON DELETE CASCADE,
  name text,
  url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_task_id uuid REFERENCES public.sub_tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity log and suspensions audit
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  sub_task_id uuid NULL REFERENCES public.sub_tasks(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text NULL,
  event_type text NOT NULL,
  from_status text NULL,
  to_status text NULL,
  detail text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Triggers helpers
-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Attach trigger to tasks and sub_tasks if not already
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='updated_at') THEN
    PERFORM 1;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_sub_tasks_updated_at ON public.sub_tasks;
CREATE TRIGGER trg_sub_tasks_updated_at BEFORE UPDATE ON public.sub_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public._log_task_activity(uuid,uuid,text,text,text,text);
CREATE OR REPLACE FUNCTION public._log_task_activity(
  p_task_id uuid,
  p_sub_task_id uuid,
  p_event_type text,
  p_from text,
  p_to text,
  p_detail text
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.task_activity_log(task_id, sub_task_id, event_type, from_status, to_status, detail, actor_id, actor_name)
  VALUES ($1, $2, $3, $4, $5, $6, auth.uid(), (SELECT full_name FROM public.profiles WHERE id = auth.uid()));
$$;
GRANT EXECUTE ON FUNCTION public._log_task_activity(uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._log_task_activity(uuid,uuid,text,text,text,text) TO service_role;

-- 5) Suspend / resume task RPCs (server-side helpers)
DROP FUNCTION IF EXISTS public.suspend_task(uuid,text);
CREATE OR REPLACE FUNCTION public.suspend_task(p_task_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks SET suspended = true, suspension_reason = p_reason, suspended_by = auth.uid(), suspended_at = now() WHERE id = p_task_id;
  INSERT INTO public.task_suspensions(task_id, suspended_by, reason) VALUES (p_task_id, auth.uid(), p_reason);
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_suspended', NULL, NULL, left(p_reason, 600));
END;$$;
GRANT EXECUTE ON FUNCTION public.suspend_task(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_task(uuid,text) TO service_role;

DROP FUNCTION IF EXISTS public.resume_task(uuid);
CREATE OR REPLACE FUNCTION public.resume_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks SET suspended = false, suspension_reason = NULL, suspended_by = NULL, suspended_at = NULL WHERE id = p_task_id;
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_resumed', NULL, NULL, 'Tarea reanudada');
END;$$;
GRANT EXECUTE ON FUNCTION public.resume_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_task(uuid) TO service_role;

-- 6) Simple task operations (mark complete / reopen)
DROP FUNCTION IF EXISTS public.mark_task_completed(uuid);
CREATE OR REPLACE FUNCTION public.mark_task_completed(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.sub_tasks SET status = 'Completada', updated_at = now() WHERE task_id = p_task_id;
  UPDATE public.tasks SET completed_by = auth.uid(), completed_at = now() WHERE id = p_task_id;
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_completed', NULL, 'Completada', 'Tarea marcada como completada');
END;$$;
GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_task_completed(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.reopen_task(uuid);
CREATE OR REPLACE FUNCTION public.reopen_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.sub_tasks SET status = 'Pendiente', updated_at = now() WHERE task_id = p_task_id;
  UPDATE public.tasks SET completed_by = NULL, completed_at = NULL WHERE id = p_task_id;
  PERFORM public._log_task_activity(p_task_id, NULL, 'task_reopened', 'Completada', 'Pendiente', 'Tarea reabierta');
END;$$;
GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_task(uuid) TO service_role;

-- --------------------------------------------------
-- Administración: tareas suspendidas pendientes de reprogramar
-- Función para que administradores listenn tareas suspendidas
CREATE OR REPLACE FUNCTION public.admin_get_suspended_tasks()
RETURNS TABLE (
  id uuid,
  title text,
  owner_id uuid,
  owner_name text,
  responsible_person_id uuid,
  responsible_name text,
  suspended_by uuid,
  suspended_by_name text,
  suspension_reason text,
  suspended_at timestamptz,
  scope jsonb,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo administradores pueden usar esta RPC
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  SELECT t.id, t.title, t.owner_id, (SELECT full_name FROM public.profiles WHERE id = t.owner_id),
         t.responsible_person_id, (SELECT full_name FROM public.profiles WHERE id = t.responsible_person_id),
         t.suspended_by, (SELECT full_name FROM public.profiles WHERE id = t.suspended_by),
         t.suspension_reason, t.suspended_at, t.scope, t.created_at, t.updated_at
  FROM public.tasks t
  WHERE t.suspended = true
    AND (t.scope IS NULL OR (t.scope->>'due_date') IS NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_suspended_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_suspended_tasks() TO service_role;

-- RPC para reprogramar una tarea: actualiza due_date dentro de scope, reanuda y registra la actividad
DROP FUNCTION IF EXISTS public.reprogram_task(uuid,timestamptz);
CREATE OR REPLACE FUNCTION public.reprogram_task(p_task_id uuid, p_new_due_date timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo administradores pueden reprogramar desde esta RPC
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  -- Actualizar due_date en el JSON scope y reanudar la tarea
  UPDATE public.tasks
  SET scope = jsonb_set(coalesce(scope, '{}'::jsonb), '{due_date}', to_jsonb(p_new_due_date::text), true),
      suspended = false,
      suspension_reason = NULL,
      suspended_by = NULL,
      suspended_at = NULL,
      updated_at = now()
  WHERE id = p_task_id;

  -- Registrar actividad
  INSERT INTO public.task_activity_log(task_id, event_type, detail, actor_id, actor_name)
  VALUES (p_task_id, 'task_reprogrammed', concat('Reprogramada a ', p_new_due_date::text), auth.uid(), (SELECT full_name FROM public.profiles WHERE id = auth.uid()));
END;
$$;
GRANT EXECUTE ON FUNCTION public.reprogram_task(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprogram_task(uuid,timestamptz) TO service_role;


-- 7) RLS: enable and policies
-- Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read/update their own profile; admins can read all
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
  DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
  DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
  DROP POLICY IF EXISTS profiles_admin_access ON public.profiles;
END$$;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_admin_access ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

-- Tasks policies: owners, responsible, and admins
DO $$ BEGIN
  DROP POLICY IF EXISTS tasks_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_update ON public.tasks;
  DROP POLICY IF EXISTS tasks_delete ON public.tasks;
END$$;
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text OR responsible_person_id::text = auth.uid()::text
);
CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);
CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
) WITH CHECK (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);
CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);

-- Sub_tasks policies: allow if parent task visible to user or assigned/self
DO $$ BEGIN
  DROP POLICY IF EXISTS sub_tasks_select ON public.sub_tasks;
  DROP POLICY IF EXISTS sub_tasks_modify ON public.sub_tasks;
END$$;
CREATE POLICY sub_tasks_select ON public.sub_tasks FOR SELECT USING (
  public.is_admin(auth.uid()) OR assigned_to_id::text = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id::text = sub_tasks.task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text)
  )
);
CREATE POLICY sub_tasks_modify ON public.sub_tasks FOR ALL USING (
  public.is_admin(auth.uid()) OR assigned_to_id::text = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id::text = sub_tasks.task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text)
  )
);

-- Documents / comments policies: visible if related sub_task is visible
DO $$ BEGIN
  DROP POLICY IF EXISTS documents_select ON public.documents;
  DROP POLICY IF EXISTS documents_modify ON public.documents;
  DROP POLICY IF EXISTS comments_select ON public.comments;
  DROP POLICY IF EXISTS comments_modify ON public.comments;
END$$;
CREATE POLICY documents_select ON public.documents FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text
    WHERE st.id::text = documents.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text OR st.assigned_to_id::text = auth.uid()::text)
  )
);
CREATE POLICY documents_modify ON public.documents FOR ALL USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text
    WHERE st.id::text = documents.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text OR st.assigned_to_id::text = auth.uid()::text)
  )
);

CREATE POLICY comments_select ON public.comments FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text
    WHERE st.id::text = comments.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text OR st.assigned_to_id::text = auth.uid()::text OR comments.author_id::text = auth.uid()::text)
  )
);
CREATE POLICY comments_modify ON public.comments FOR ALL USING (
  public.is_admin(auth.uid()) OR comments.author_id::text = auth.uid()::text
);

-- Activity log: restrict to admins and service_role for select; inserts allowed from service_role
DO $$ BEGIN
  DROP POLICY IF EXISTS task_activity_log_select ON public.task_activity_log;
  DROP POLICY IF EXISTS task_activity_log_insert ON public.task_activity_log;
END$$;
CREATE POLICY task_activity_log_select ON public.task_activity_log FOR SELECT USING (public.is_admin(auth.uid()) OR auth.role() = 'service_role');
CREATE POLICY task_activity_log_insert ON public.task_activity_log FOR INSERT WITH CHECK (auth.role() = 'service_role' OR public.is_admin(auth.uid()));

-- 8) Indexes
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email))';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON public.tasks(responsible_person_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks((scope->>'due_date'));
CREATE INDEX IF NOT EXISTS idx_sub_tasks_task ON public.sub_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_subtask ON public.documents(sub_task_id);
CREATE INDEX IF NOT EXISTS idx_comments_subtask ON public.comments(sub_task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity_log(task_id, created_at);

-- 9) Grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_activity_log TO authenticated;

-- 10) Notify PostgREST to reload (best-effort)
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

-- Fin del script
