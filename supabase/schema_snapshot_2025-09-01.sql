-- schema_snapshot_2025-09-01.sql
-- Respaldo consolidado (idempotente) del esquema principal "sano".
-- Uso recomendado:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f schema_snapshot_2025-09-01.sql
--   (No incluye datos excepto filas singleton / mínimas.)
-- Mantener este snapshot SOLO como referencia; seguir trabajando con migraciones incrementales.

BEGIN;

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tipos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','director_campus','director_facultad','usuario');
  END IF;
END $$;

-- 3. Tablas base
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  role user_role DEFAULT 'usuario',
  email text UNIQUE,
  scope_entity text NULL,
  mobile text NULL,
  position text NULL,
  campus text NULL,
  area text NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.institution_profile (
  id serial PRIMARY KEY,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  website text,
  legal_representative text,
  logo_url text,
  phone_country_code text,
  locations jsonb,
  educational_levels text[],
  authorities jsonb,
  academic_programs jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
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
  activity text NOT NULL,
  phase text NOT NULL,
  start_date date,
  end_date date,
  completed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.audit_history_log (
  id bigserial PRIMARY KEY,
  audit_id bigint NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text NULL,
  event_type text NOT NULL,
  detail jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  remind_at timestamptz NULL,
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.responsible_areas (
  id bigserial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  context jsonb
);

-- 4. Funciones auxiliares
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.is_admin(user_id uuid)
    RETURNS boolean
    LANGUAGE sql STABLE AS $fn$
      SELECT EXISTS(
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = user_id AND pr.role = 'admin'
      );
    $fn$;
  END IF;
END $$;

-- is_project_owner depende de project_members
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.project_id = p_project AND pm.user_id = auth.uid() AND pm.role = 'owner'
  );
$fn$;

-- 5. RLS enable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_phase_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_history_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsible_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 6. Policies (solo las esenciales / simplificadas)
-- Perfiles
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_admin_access ON public.profiles;
CREATE POLICY profiles_admin_access ON public.profiles FOR ALL USING (public.is_admin(auth.uid()) OR auth.role() = 'service_role');

-- Institution profile
DROP POLICY IF EXISTS "Anyone can view institution profile" ON public.institution_profile;
CREATE POLICY "Anyone can view institution profile" ON public.institution_profile FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can update institution profile" ON public.institution_profile;
CREATE POLICY "Only admins can update institution profile" ON public.institution_profile FOR ALL USING (public.is_admin(auth.uid()));

-- Projects & members
DROP POLICY IF EXISTS projects_owner_full ON public.projects;
CREATE POLICY projects_owner_full ON public.projects FOR ALL USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS projects_members_select ON public.projects;
CREATE POLICY projects_members_select ON public.projects FOR SELECT USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()));

DROP POLICY IF EXISTS project_members_user_select ON public.project_members;
CREATE POLICY project_members_user_select ON public.project_members FOR SELECT USING (user_id = auth.uid() OR public.is_project_owner(project_members.project_id));
DROP POLICY IF EXISTS project_members_owner_insert ON public.project_members;
CREATE POLICY project_members_owner_insert ON public.project_members FOR INSERT WITH CHECK (public.is_project_owner(project_members.project_id));
DROP POLICY IF EXISTS project_members_owner_update ON public.project_members;
CREATE POLICY project_members_owner_update ON public.project_members FOR UPDATE USING (public.is_project_owner(project_members.project_id)) WITH CHECK (public.is_project_owner(project_members.project_id));
DROP POLICY IF EXISTS project_members_owner_delete ON public.project_members;
CREATE POLICY project_members_owner_delete ON public.project_members FOR DELETE USING (public.is_project_owner(project_members.project_id));

-- Tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (
  public.is_admin(auth.uid()) OR owner_id = auth.uid() OR responsible_person_id = auth.uid()
);
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK (
  public.is_admin(auth.uid()) OR owner_id = auth.uid()
);
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (
  public.is_admin(auth.uid()) OR owner_id = auth.uid() OR responsible_person_id = auth.uid()
) WITH CHECK (
  public.is_admin(auth.uid()) OR owner_id = auth.uid() OR responsible_person_id = auth.uid()
);
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (
  public.is_admin(auth.uid()) OR owner_id = auth.uid()
);

-- Sub tasks
DROP POLICY IF EXISTS sub_tasks_select ON public.sub_tasks;
CREATE POLICY sub_tasks_select ON public.sub_tasks FOR SELECT USING (
  public.is_admin(auth.uid()) OR assigned_to_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = sub_tasks.task_id AND (t.owner_id = auth.uid() OR t.responsible_person_id = auth.uid()))
);
DROP POLICY IF EXISTS sub_tasks_modify ON public.sub_tasks;
CREATE POLICY sub_tasks_modify ON public.sub_tasks FOR ALL USING (
  public.is_admin(auth.uid()) OR assigned_to_id = auth.uid()
) WITH CHECK (
  public.is_admin(auth.uid()) OR assigned_to_id = auth.uid()
);

-- Documents
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.sub_tasks s WHERE s.id = documents.sub_task_id AND (s.assigned_to_id = auth.uid()))
);
DROP POLICY IF EXISTS documents_modify ON public.documents;
CREATE POLICY documents_modify ON public.documents FOR ALL USING (
  public.is_admin(auth.uid())
) WITH CHECK (public.is_admin(auth.uid()));

-- Comments
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT USING (
  public.is_admin(auth.uid()) OR author_id = auth.uid()
);
DROP POLICY IF EXISTS comments_modify ON public.comments;
CREATE POLICY comments_modify ON public.comments FOR ALL USING (
  public.is_admin(auth.uid()) OR author_id = auth.uid()
) WITH CHECK (
  public.is_admin(auth.uid()) OR author_id = auth.uid()
);

-- Reminders / responsible areas
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

-- Audits (simplificado)
DROP POLICY IF EXISTS audits_select ON public.audits;
CREATE POLICY audits_select ON public.audits FOR SELECT USING (
  public.is_admin(auth.uid()) OR auditor_id = auth.uid() OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
DROP POLICY IF EXISTS audits_insert ON public.audits;
CREATE POLICY audits_insert ON public.audits FOR INSERT WITH CHECK (
  public.is_admin(auth.uid()) OR auditor_id = auth.uid() OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
DROP POLICY IF EXISTS audits_update ON public.audits;
CREATE POLICY audits_update ON public.audits FOR UPDATE USING (
  public.is_admin(auth.uid()) OR auditor_id = auth.uid() OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
) WITH CHECK (
  public.is_admin(auth.uid()) OR auditor_id = auth.uid() OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
DROP POLICY IF EXISTS audits_delete ON public.audits;
CREATE POLICY audits_delete ON public.audits FOR DELETE USING (
  public.is_admin(auth.uid()) OR auditor_id = auth.uid() OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);

-- Findings / tasks links
DROP POLICY IF EXISTS audit_findings_select ON public.audit_findings;
CREATE POLICY audit_findings_select ON public.audit_findings FOR SELECT USING (
  public.is_admin(auth.uid())
);
DROP POLICY IF EXISTS audit_findings_modify ON public.audit_findings;
CREATE POLICY audit_findings_modify ON public.audit_findings FOR ALL USING (
  public.is_admin(auth.uid())
) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS audit_tasks_select ON public.audit_tasks;
CREATE POLICY audit_tasks_select ON public.audit_tasks FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS audit_tasks_modify ON public.audit_tasks;
CREATE POLICY audit_tasks_modify ON public.audit_tasks FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Activity / history
DROP POLICY IF EXISTS audit_phase_activities_policy ON public.audit_phase_activities;
CREATE POLICY audit_phase_activities_policy ON public.audit_phase_activities FOR ALL USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS audit_history_log_policy ON public.audit_history_log;
CREATE POLICY audit_history_log_policy ON public.audit_history_log FOR ALL USING (public.is_admin(auth.uid()));

-- Error logs
DROP POLICY IF EXISTS error_logs_insert ON public.error_logs;
CREATE POLICY error_logs_insert ON public.error_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS error_logs_select_admin ON public.error_logs;
CREATE POLICY error_logs_select_admin ON public.error_logs FOR SELECT USING (public.is_admin(auth.uid()));

-- 7. Índices básicos
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_task ON public.sub_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON public.audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit ON public.audit_findings(audit_id);

-- 8. Datos seed mínimos
INSERT INTO public.institution_profile (id, name) VALUES (1, 'Institución Educativa') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.institution_profile (id, name) VALUES (1, 'Institución Educativa') ON CONFLICT (id) DO NOTHING;
UPDATE public.institution_profile SET locations = COALESCE(locations,'[]'::jsonb), authorities = COALESCE(authorities,'[]'::jsonb), academic_programs = COALESCE(academic_programs,'[]'::jsonb) WHERE id = 1;

-- 9. Notificar a PostgREST
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN others THEN NULL; END $$;

COMMIT;
