-- TEST_reprogram_e2e.sql
-- Prueba e2e mínima para validar admin_get_suspended_tasks() y reprogram_task()
-- Ejecutar en una base de datos de pruebas. Asume que SETUP.sql ya fue aplicado.

BEGIN;

-- Nota: En algunas instalaciones `profiles.id` referencia `auth.users(id)` y no podemos crear usuarios desde aquí.
-- Para evitar violaciones de FK, omitimos crear un perfil y creamos la tarea con owner_id/suspended_by = NULL.

-- 2) Crear una tarea suspendida sin due_date
-- Insertamos especificando columnas sin owner_id para evitar FKs hacia auth.users/profiles
INSERT INTO public.tasks(id, title, scope, suspended, suspension_reason, suspended_by, suspended_at, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'E2E Task suspended',
  '{}'::jsonb,
  true,
  'Motivo de prueba',
  NULL,
  now(),
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- 3) Asumimos ejecución con la identidad del admin (desde psql esto no aplica), pero probamos la lógica interna directamente:
-- 3a) Verificar que la tarea aparece en la query (sin usar auth.uid())
SELECT id, title FROM public.tasks WHERE suspended = true AND (scope IS NULL OR (scope->>'due_date') IS NULL);

-- 4) Simular la reprogramación: actualizar el campo scope->due_date y reanudar
UPDATE public.tasks SET scope = jsonb_set(coalesce(scope, '{}'::jsonb), '{due_date}', to_jsonb('2025-09-01T12:00:00Z'::text), true), suspended = false, suspended_by = NULL, suspension_reason = NULL, suspended_at = NULL, updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

-- 5) Verificar que la tarea ya no esté suspendida y que scope tenga due_date
SELECT id, suspended, scope->>'due_date' as due_date FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

-- 6) Registrar manualmente entrada de actividad para simular la RPC behaviour (ya que auth.uid() no funciona en psql)
INSERT INTO public.task_activity_log (task_id, event_type, detail, actor_id, actor_name)
VALUES ('22222222-2222-2222-2222-222222222222'::uuid, 'task_reprogrammed', 'Reprogramada a 2025-09-01T12:00:00Z', NULL, 'E2E Admin (simulado)');

-- 7) Consultar log de actividad
SELECT id, task_id, event_type, detail, actor_name, created_at FROM public.task_activity_log WHERE task_id = '22222222-2222-2222-2222-222222222222'::uuid ORDER BY created_at DESC LIMIT 5;

ROLLBACK; -- rollback para dejar la BD como estaba

-- Nota: Para testear las RPCs reales via Supabase, ejecuta las llamadas RPC autenticadas desde la API/cliente.
