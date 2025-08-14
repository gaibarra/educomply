-- RLS de tareas por proyecto (permitiendo tareas globales cuando project_id es NULL)
-- Ejecuta este script después de tener creados projects, project_members y la función public.is_member(uuid)

-- 1) Asegurar columna y FK (si no existe)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2) Índices útiles
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON public.tasks(responsible_person_id);

-- 3) Habilitar RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4) Limpiar políticas previas para evitar solapamientos (tanto antiguas como de este script)
DO $$ BEGIN
  PERFORM 1;
  BEGIN DROP POLICY IF EXISTS tasks_select ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_insert ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_update ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_delete ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_select_visible ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_insert_owner_check ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_update_allowed ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS tasks_delete_allowed ON public.tasks; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- 5) Políticas basadas en pertenencia al proyecto
-- Lectura: dueño, responsable, tarea global (sin proyecto) o miembro del proyecto
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (
  auth.role() = 'service_role'
  OR owner_id = auth.uid()
  OR responsible_person_id = auth.uid()
  OR project_id IS NULL
  OR public.is_member(project_id)
);

-- Inserción: sólo quien será owner; si hay project_id debe ser miembro
CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK (
  auth.role() = 'service_role'
  OR (
    owner_id = auth.uid()
    AND (project_id IS NULL OR public.is_member(project_id))
  )
);

-- Actualización: dueño o miembro; mantener pertenencia tras el cambio
CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (
  auth.role() = 'service_role' OR owner_id = auth.uid() OR public.is_member(project_id)
) WITH CHECK (
  auth.role() = 'service_role' OR project_id IS NULL OR public.is_member(project_id)
);

-- Borrado: dueño o miembro del proyecto
CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (
  auth.role() = 'service_role' OR owner_id = auth.uid() OR public.is_member(project_id)
);

-- 6) Grants (RLS aplica de todas formas)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;

-- 7) Verificación opcional
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='tasks';
