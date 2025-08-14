-- Restrict RLS: only admins or assigned auditors can see/modify audits and related tables

-- Ensure RLS enabled (idempotent)
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tasks ENABLE ROW LEVEL SECURITY;

-- Drop previous permissive policies, if any
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

-- New strict policies
-- Admin check uses public.is_admin(uid) defined elsewhere. Fallback to auditor_id match.

-- audits: admin OR assigned auditor OR owner of linked project
CREATE POLICY audits_select ON public.audits FOR SELECT USING (
  public.is_admin(auth.uid())
  OR auditor_id::text = auth.uid()::text
  OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
CREATE POLICY audits_insert ON public.audits FOR INSERT WITH CHECK (
  public.is_admin(auth.uid())
  OR auditor_id::text = auth.uid()::text
  OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
CREATE POLICY audits_update ON public.audits FOR UPDATE USING (
  public.is_admin(auth.uid())
  OR auditor_id::text = auth.uid()::text
  OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
) WITH CHECK (
  public.is_admin(auth.uid())
  OR auditor_id::text = auth.uid()::text
  OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);
CREATE POLICY audits_delete ON public.audits FOR DELETE USING (
  public.is_admin(auth.uid())
  OR auditor_id::text = auth.uid()::text
  OR (project_id IS NOT NULL AND public.is_project_owner(project_id))
);

-- audit_findings: visible/editable only if parent audit is visible to you
CREATE POLICY audit_findings_select ON public.audit_findings FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_findings.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
);
CREATE POLICY audit_findings_modify ON public.audit_findings FOR ALL USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_findings.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
) WITH CHECK (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_findings.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
);

-- audit_tasks link: same visibility via parent audit
CREATE POLICY audit_tasks_select ON public.audit_tasks FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_tasks.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
);
CREATE POLICY audit_tasks_modify ON public.audit_tasks FOR ALL USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_tasks.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
) WITH CHECK (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id::text = audit_tasks.audit_id::text
      AND (
        a.auditor_id::text = auth.uid()::text OR (a.project_id IS NOT NULL AND public.is_project_owner(a.project_id))
      )
  )
);

-- Grants (keep)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_tasks TO authenticated;

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN others THEN NULL; END $$;
