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

-- 2) Tablas principales (idempotente)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  role user_role DEFAULT 'usuario',
  metadata jsonb DEFAULT '{}'::jsonb, -- For any other unstructured data
  created_at timestamptz NOT NULL DEFAULT now() -- Auditing
);

-- Asegurar que las columnas existan en la tabla de perfiles para evitar errores
-- en instalaciones parciales o actualizaciones.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scope_entity text NULL; -- e.g., 'Campus Norte'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile text NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campus text NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area text NULL;

-- Insert the admin user if it doesn't exist
INSERT INTO public.profiles (id, email, role) 
VALUES ('8a3301d6-8cbc-476e-b368-731ef42cdd76', 'complianceunimodelo@gmail.com', 'admin') 
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamp with time zone not null default now(),
  primary key (project_id, user_id)
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

-- Sección de Auditorías
CREATE TABLE IF NOT EXISTS public.audits (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  scope_level text NOT NULL DEFAULT 'General',
  scope_entity text NULL,
  status text NOT NULL DEFAULT 'Planificada',
  start_date date NOT NULL,
  end_date date NOT NULL,
  auditor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  ai_description text,
  ai_raw_suggestion jsonb,
  current_phase text DEFAULT 'planificacion',
  phase_activities jsonb,
  phase_log jsonb
);

CREATE TABLE IF NOT EXISTS public.audit_findings (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  description text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,
  recommendation text NOT NULL,
  related_task_id uuid NULL REFERENCES public.tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.audit_tasks (
  audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (audit_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.audit_phase_activities (
    id bigserial PRIMARY KEY,
    audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    phase text NOT NULL,
    description text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_history_log (
    id bigserial PRIMARY KEY,
    audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name text,
    event_type text NOT NULL,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  remind_at timestamptz null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.responsible_areas (
  id bigserial primary key,
  name text not null
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

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  return new;
END;
$$;

-- Trigger to create a profile when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

create or replace function public.is_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.owner_id = auth.uid()
  );
$$;

create or replace function public.ensure_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_members(project_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (project_id, user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_owner_membership on public.projects;
create trigger trg_projects_owner_membership
  after insert on public.projects
  for each row execute function public.ensure_owner_membership();

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

create or replace function public.search_user_emails(p_prefix text)
returns table(email text, id uuid)
language sql
stable
security definer
set search_path = public, auth as $$
  select u.email, u.id
  from auth.users u
  where u.email ilike p_prefix || '%'
  order by u.email
  limit 10;
$$;

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
-- Función para que administradores listen tareas suspendidas

-- Eliminar ambas firmas para asegurar la idempotencia
DROP FUNCTION IF EXISTS public.admin_get_suspended_tasks();
DROP FUNCTION IF EXISTS public.admin_get_suspended_tasks(text, int, int);

-- Crear la nueva función con paginación y búsqueda
CREATE OR REPLACE FUNCTION public.admin_get_suspended_tasks(p_search_term text default '', p_page_num int default 1, p_page_size int default 10)
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
  updated_at timestamptz,
  total_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo administradores pueden usar esta RPC
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;
  
  RETURN QUERY
  with suspended_tasks as (
    select
      t.id, t.title, t.owner_id, o.full_name as owner_name,
      t.responsible_person_id, r.full_name as responsible_name,
      t.suspended_by, s.full_name as suspended_by_name,
      t.suspension_reason, t.suspended_at, t.scope, t.created_at, t.updated_at,
      count(*) over() as total_count
    from tasks t
    left join profiles o on t.owner_id = o.id
    left join profiles r on t.responsible_person_id = r.id
    left join profiles s on t.suspended_by = s.id
    where t.suspended = true
      and (p_search_term = '' or t.title ilike '%' || p_search_term || '%' or o.full_name ilike '%' || p_search_term || '%' or r.full_name ilike '%' || p_search_term || '%')
  )
  select * from suspended_tasks
  order by suspended_tasks.suspended_at desc
  limit p_page_size
  offset (p_page_num - 1) * p_page_size;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_suspended_tasks(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_suspended_tasks(text, int, int) TO service_role;

-- RPC para reprogramar una tarea: actualiza due_date dentro de scope, reanuda y registra la actividad
-- Se define con `text` para `p_new_due_date` para coincidir con la llamada del cliente (ISO string) y evitar ambigüedad.
DROP FUNCTION IF EXISTS public.reprogram_task(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.reprogram_task(uuid, text);

CREATE OR REPLACE FUNCTION public.reprogram_task(p_task_id uuid, p_new_due_date text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_user_name text;
BEGIN
  -- Solo administradores pueden reprogramar
  IF NOT public.is_admin(current_user_id) THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  -- Obtener nombre del actor para el log
  SELECT full_name INTO current_user_name FROM public.profiles WHERE id = current_user_id;

  -- Actualizar due_date en el JSON scope y reanudar la tarea
  UPDATE public.tasks
  SET scope = jsonb_set(coalesce(scope, '{}'::jsonb), '{due_date}', to_jsonb(p_new_due_date), true),
      suspended = false,
      suspension_reason = NULL,
      suspended_by = NULL,
      suspended_at = NULL,
      updated_at = now()
  WHERE id = p_task_id;

  -- Registrar actividad
  INSERT INTO public.task_activity_log(task_id, event_type, detail, actor_id, actor_name)
  VALUES (p_task_id, 'task_reprogrammed', 'Tarea reprogramada. Nueva fecha: ' || to_char(p_new_due_date::timestamptz, 'DD/MM/YYYY HH24:MI'), current_user_id, current_user_name);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reprogram_task(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprogram_task(uuid, text) TO service_role;

-- Funciones de Auditoría
CREATE OR REPLACE FUNCTION public.get_audit_details(p_audit_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    audit_details jsonb;
BEGIN
    -- Solo usuarios autorizados (admin o auditor asignado)
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = p_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT jsonb_build_object(
        'audit', to_jsonb(a),
        'auditor', to_jsonb(p),
        'findings', (SELECT jsonb_agg(f) FROM audit_findings f WHERE f.audit_id = a.id),
        'activities', (SELECT jsonb_agg(act) FROM audit_phase_activities act WHERE act.audit_id = a.id),
        'history', (SELECT jsonb_agg(h) FROM audit_history_log h WHERE h.audit_id = a.id ORDER BY h.created_at DESC)
    )
    INTO audit_details
    FROM audits a
    LEFT JOIN profiles p ON a.auditor_id = p.id
    WHERE a.id = p_audit_id;

    RETURN audit_details;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_audit_phase(p_audit_id bigint, p_new_phase text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    old_phase text;
BEGIN
    -- Solo admin o auditor asignado
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = p_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT current_phase INTO old_phase FROM audits WHERE id = p_audit_id;

    UPDATE audits SET current_phase = p_new_phase, updated_at = now() WHERE id = p_audit_id;

    INSERT INTO audit_history_log (audit_id, actor_id, actor_name, event_type, detail)
    VALUES (p_audit_id, auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()), 'phase_change', jsonb_build_object('from', old_phase, 'to', p_new_phase));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_audit_activity(p_activity_id bigint, p_completed boolean, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_audit_id bigint;
    v_activity_desc text;
BEGIN
    SELECT audit_id, description INTO v_audit_id, v_activity_desc FROM audit_phase_activities WHERE id = p_activity_id;

    IF v_audit_id IS NULL THEN RAISE EXCEPTION 'Activity not found'; END IF;

    -- Solo admin o auditor asignado
    IF NOT (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = v_audit_id AND auditor_id = auth.uid())) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    UPDATE audit_phase_activities SET completed = p_completed, notes = p_notes, updated_at = now() WHERE id = p_activity_id;

    INSERT INTO audit_history_log (audit_id, actor_id, actor_name, event_type, detail)
    VALUES (v_audit_id, auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()), 'activity_update', jsonb_build_object('activity', v_activity_desc, 'completed', p_completed));
END;
$$;

-- 7) RLS: enable and policies
-- Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_phase_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_history_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsible_areas ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read/update their own profile; admins can read all
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_access ON public.profiles;
CREATE POLICY profiles_admin_access ON public.profiles FOR ALL USING (public.is_admin(auth.uid()) OR (auth.uid() = id));

-- Projects RLS
DROP POLICY IF EXISTS projects_owner_full ON public.projects;
CREATE POLICY projects_owner_full on public.projects
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

DROP POLICY IF EXISTS projects_members_select ON public.projects;
CREATE POLICY projects_members_select on public.projects
  for select using (
    auth.uid() = owner_id or public.is_member(projects.id)
  );

DROP POLICY IF EXISTS project_members_user_select ON public.project_members;
CREATE POLICY project_members_user_select on public.project_members
  for select using (
    user_id = auth.uid() or public.is_project_owner(project_members.project_id)
  );

DROP POLICY IF EXISTS project_members_owner_insert ON public.project_members;
CREATE POLICY project_members_owner_insert on public.project_members
  for insert with check (public.is_project_owner(project_members.project_id));

DROP POLICY IF EXISTS project_members_owner_update ON public.project_members;
CREATE POLICY project_members_owner_update on public.project_members
  for update using (public.is_project_owner(project_members.project_id))
  with check (public.is_project_owner(project_members.project_id));

DROP POLICY IF EXISTS project_members_owner_delete ON public.project_members;
CREATE POLICY project_members_owner_delete on public.project_members
  for delete using (public.is_project_owner(project_members.project_id));

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

-- Audits RLS
DROP POLICY IF EXISTS audits_select ON public.audits;
CREATE POLICY audits_select ON public.audits FOR SELECT USING (public.is_admin(auth.uid()) OR auditor_id::text = auth.uid()::text OR (project_id IS NOT NULL AND public.is_project_owner(project_id)));

DROP POLICY IF EXISTS audits_insert ON public.audits;
CREATE POLICY audits_insert ON public.audits FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR auditor_id::text = auth.uid()::text OR (project_id IS NOT NULL AND public.is_project_owner(project_id)));

DROP POLICY IF EXISTS audits_update ON public.audits;
CREATE POLICY audits_update ON public.audits FOR UPDATE USING (public.is_admin(auth.uid()) OR auditor_id::text = auth.uid()::text OR (project_id IS NOT NULL AND public.is_project_owner(project_id))) WITH CHECK (public.is_admin(auth.uid()) OR auditor_id::text = auth.uid()::text OR (project_id IS NOT NULL AND public.is_project_owner(project_id)));

DROP POLICY IF EXISTS audits_delete ON public.audits;
CREATE POLICY audits_delete ON public.audits FOR DELETE USING (public.is_admin(auth.uid()) OR auditor_id::text = auth.uid()::text OR (project_id IS NOT NULL AND public.is_project_owner(project_id)));

DROP POLICY IF EXISTS audit_findings_select ON public.audit_findings;
CREATE POLICY audit_findings_select ON public.audit_findings FOR SELECT USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_findings.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id)))));

DROP POLICY IF EXISTS audit_findings_modify ON public.audit_findings;
CREATE POLICY audit_findings_modify ON public.audit_findings FOR ALL USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_findings.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))))) WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_findings.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id)))));

DROP POLICY IF EXISTS audit_tasks_select ON public.audit_tasks;
CREATE POLICY audit_tasks_select ON public.audit_tasks FOR SELECT USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_tasks.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id)))));

DROP POLICY IF EXISTS audit_tasks_modify ON public.audit_tasks;
CREATE POLICY audit_tasks_modify ON public.audit_tasks FOR ALL USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_tasks.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))))) WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.audits a WHERE a.id::text = audit_tasks.audit_id::text AND (a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id)))));

DROP POLICY IF EXISTS audit_phase_activities_policy ON public.audit_phase_activities;
CREATE POLICY audit_phase_activities_policy ON public.audit_phase_activities FOR ALL USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = audit_id AND auditor_id = auth.uid()));

DROP POLICY IF EXISTS audit_history_log_policy ON public.audit_history_log;
CREATE POLICY audit_history_log_policy ON public.audit_history_log FOR ALL USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM audits WHERE id = audit_id AND auditor_id = auth.uid()));

DROP POLICY IF EXISTS reminders_select_own ON public.reminders;
CREATE POLICY reminders_select_own ON public.reminders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reminders_insert_own ON public.reminders;
CREATE POLICY reminders_insert_own ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reminders_update_own ON public.reminders;
CREATE POLICY reminders_update_own ON public.reminders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reminders_delete_own ON public.reminders;
CREATE POLICY reminders_delete_own ON public.reminders FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS responsible_areas_select ON public.responsible_areas;
CREATE POLICY responsible_areas_select ON public.responsible_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS responsible_areas_insert ON public.responsible_areas;
CREATE POLICY responsible_areas_insert ON public.responsible_areas FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS responsible_areas_update ON public.responsible_areas;
CREATE POLICY responsible_areas_update ON public.responsible_areas FOR UPDATE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS responsible_areas_delete ON public.responsible_areas;
CREATE POLICY responsible_areas_delete ON public.responsible_areas FOR DELETE USING (public.is_admin(auth.uid()));

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
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON public.audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_project_id ON public.audits(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit ON public.audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_audit ON public.audit_tasks(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_task ON public.audit_tasks(task_id);
CREATE INDEX IF NOT EXISTS reminders_user_time_idx ON public.reminders(user_id, remind_at);
CREATE INDEX IF NOT EXISTS reminders_task_idx ON public.reminders(task_id);

-- 9) Grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_phase_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_history_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsible_areas TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_user_emails(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_details(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_audit_phase(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_audit_activity(bigint, boolean, text) TO authenticated;

-- 10) Notify PostgREST to reload (best-effort)
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

-- Fin del script