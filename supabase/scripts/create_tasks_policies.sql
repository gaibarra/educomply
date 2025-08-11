-- Simplified RLS policies for tasks (no project membership). Owner / responsible based access.
-- Remove or ignore previous project-based configuration if not needed.

-- 1. Ensure RLS enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. (Optional) Temporarily disable RLS while backfilling data
-- ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY; -- ONLY if you need to mass update/fix project_id
-- ... perform data fixes ...
-- ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid overlap
DO $$ BEGIN
  DROP POLICY IF EXISTS tasks_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_update ON public.tasks;
  DROP POLICY IF EXISTS tasks_delete ON public.tasks;
END $$;

-- (Optional) If project_id column exists and you no longer use it, you may allow null or drop it:
-- ALTER TABLE public.tasks ALTER COLUMN project_id DROP NOT NULL;
-- ALTER TABLE public.tasks DROP COLUMN project_id;

-- Remove membership function if previously created (optional):
-- DROP FUNCTION IF EXISTS public.is_member(uuid);

-- Selection: owners or responsible persons (plus service_role)
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (
  auth.role() = 'service_role' OR owner_id = auth.uid() OR responsible_person_id = auth.uid()
);

-- Insert: only create tasks you own
CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK (
  auth.role() = 'service_role' OR owner_id = auth.uid()
);

-- Update: only owners
CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (
  auth.role() = 'service_role' OR owner_id = auth.uid()
) WITH CHECK (
  auth.role() = 'service_role' OR owner_id = auth.uid()
);

-- Delete: only owners
CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (
  auth.role() = 'service_role' OR owner_id = auth.uid()
);

-- 10. Ensure function executable by authenticated (no need for explicit grant if in public and default privileges ok)
-- (If you dropped is_member, revoke execute optional)
-- REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM authenticated;

-- 11. (Re)Create simple policies for project_members to prevent 500 errors (lack of SELECT)
-- project_members table no longer needed for tasks RLS; you may drop it if unused.
-- DROP TABLE IF EXISTS public.project_members;
-- Previous guidance about infinite recursion removed because project_members is no longer used.
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='tasks';

-- 14. Test (example):
-- SELECT 1 FROM public.tasks WHERE project_id = '<some-project-uuid>' LIMIT 1;

-- If you need owner-specific overrides, add OR owner_id = auth.uid() to USING / WITH CHECK clauses.

/*
================================================================================
INFINITE RECURSION (42P17) NOTE
================================================================================
Si aparece el error:
  infinite recursion detected in policy for relation "project_members"
significa que alguna política definida sobre project_members hace una sub‑consulta
que vuelve a leer project_members, provocando un ciclo.

Solución rápida:
1. Elimina las políticas actuales sobre project_members.
2. Crea políticas simples que NO referencien project_members dentro de su propio USING / WITH CHECK.

Ejemplo seguro:
  DO $$ BEGIN
    DROP POLICY IF EXISTS project_members_select ON public.project_members;
    DROP POLICY IF EXISTS project_members_insert ON public.project_members;
    DROP POLICY IF EXISTS project_members_update ON public.project_members;
    DROP POLICY IF EXISTS project_members_delete ON public.project_members;
  END $$;

  -- Ver sólo filas propias
  CREATE POLICY project_members_select ON public.project_members FOR SELECT USING ( user_id = auth.uid() OR auth.role() = 'service_role');
  -- Insertar sólo para sí mismo
  CREATE POLICY project_members_insert ON public.project_members FOR INSERT WITH CHECK ( user_id = auth.uid() OR auth.role() = 'service_role');
  -- Actualizar / borrar sólo propias
  CREATE POLICY project_members_update ON public.project_members FOR UPDATE USING ( user_id = auth.uid() OR auth.role() = 'service_role') WITH CHECK ( user_id = auth.uid() OR auth.role() = 'service_role');
  CREATE POLICY project_members_delete ON public.project_members FOR DELETE USING ( user_id = auth.uid() OR auth.role() = 'service_role');

Luego las políticas de tasks pueden usar EXISTS / IN sin causar recursión:
   project_id IN (
     SELECT pm.project_id FROM public.project_members pm
     WHERE pm.user_id = auth.uid()
   )

O bien, alternativa con función (evita varias repeticiones):
  CREATE OR REPLACE FUNCTION public.is_member(p_project uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS(
      SELECT 1 FROM public.project_members m
      WHERE m.project_id = p_project AND m.user_id = auth.uid()
    );
  $$;
  -- Asegúrate que el owner de la función sea el owner de project_members para bpn de RLS.

  Luego en las políticas:
    USING (auth.role() = 'service_role' OR public.is_member(project_id))
    WITH CHECK (auth.role() = 'service_role' OR public.is_member(project_id))

Importante: Evita escribir políticas sobre project_members que hagan SELECT a project_members con filtros más complejos que vuelvan a invocar la misma política.
================================================================================
*/
