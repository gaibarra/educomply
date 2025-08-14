-- Create/align audits, audit_findings, audit_tasks schema and RLS

-- 1) audits table
CREATE TABLE IF NOT EXISTS public.audits (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  scope_level text NOT NULL DEFAULT 'General',
  scope_entity text NULL,
  status text NOT NULL DEFAULT 'Planificada',
  start_date date NOT NULL,
  end_date date NOT NULL
);

-- Ensure auditor_id column exists and FK to profiles
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS auditor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'audits' AND constraint_name = 'audits_auditor_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.audits
        ADD CONSTRAINT audits_auditor_id_fkey FOREIGN KEY (auditor_id)
        REFERENCES public.profiles(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- 2) audit_findings table
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  audit_id bigint NOT NULL,
  description text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,
  recommendation text NOT NULL,
  related_task_id uuid NULL
);

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='audit_findings' AND constraint_name='audit_findings_audit_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.audit_findings
        ADD CONSTRAINT audit_findings_audit_id_fkey FOREIGN KEY (audit_id)
        REFERENCES public.audits(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='audit_findings' AND constraint_name='audit_findings_related_task_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.audit_findings
        ADD CONSTRAINT audit_findings_related_task_id_fkey FOREIGN KEY (related_task_id)
        REFERENCES public.tasks(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- 3) audit_tasks link table
CREATE TABLE IF NOT EXISTS public.audit_tasks (
  audit_id bigint NOT NULL,
  task_id uuid NOT NULL,
  PRIMARY KEY (audit_id, task_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='audit_tasks' AND constraint_name='audit_tasks_audit_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.audit_tasks
        ADD CONSTRAINT audit_tasks_audit_id_fkey FOREIGN KEY (audit_id)
        REFERENCES public.audits(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='audit_tasks' AND constraint_name='audit_tasks_task_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.audit_tasks
        ADD CONSTRAINT audit_tasks_task_id_fkey FOREIGN KEY (task_id)
        REFERENCES public.tasks(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON public.audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit ON public.audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_audit ON public.audit_tasks(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_task ON public.audit_tasks(task_id);

-- 5) RLS
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tasks ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DO $$ BEGIN
  -- audits
  BEGIN DROP POLICY IF EXISTS audits_select ON public.audits; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS audits_insert ON public.audits; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS audits_update ON public.audits; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS audits_delete ON public.audits; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- audit_findings
  BEGIN DROP POLICY IF EXISTS audit_findings_select ON public.audit_findings; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS audit_findings_modify ON public.audit_findings; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- audit_tasks
  BEGIN DROP POLICY IF EXISTS audit_tasks_select ON public.audit_tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS audit_tasks_modify ON public.audit_tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Simple policies (adjust later as needed)
-- audits: allow select/insert to authenticated; update/delete if you are the assigned auditor or admin
CREATE POLICY audits_select ON public.audits FOR SELECT USING ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );
CREATE POLICY audits_insert ON public.audits FOR INSERT WITH CHECK ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );
CREATE POLICY audits_update ON public.audits FOR UPDATE USING ( auth.role() = 'service_role' OR auditor_id = auth.uid() ) WITH CHECK ( auth.role() = 'service_role' OR auditor_id = auth.uid() );
CREATE POLICY audits_delete ON public.audits FOR DELETE USING ( auth.role() = 'service_role' OR auditor_id = auth.uid() );

-- audit_findings: visible/editable if parent audit is visible to you (approximate: any authenticated)
CREATE POLICY audit_findings_select ON public.audit_findings FOR SELECT USING ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );
CREATE POLICY audit_findings_modify ON public.audit_findings FOR ALL USING ( auth.role() = 'service_role' OR auth.role() = 'authenticated' ) WITH CHECK ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );

-- audit_tasks link: allow authenticated
CREATE POLICY audit_tasks_select ON public.audit_tasks FOR SELECT USING ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );
CREATE POLICY audit_tasks_modify ON public.audit_tasks FOR ALL USING ( auth.role() = 'service_role' OR auth.role() = 'authenticated' ) WITH CHECK ( auth.role() = 'service_role' OR auth.role() = 'authenticated' );

-- 6) Grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_tasks TO authenticated;

-- 7) Refresh PostgREST schema cache (Supabase)
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
