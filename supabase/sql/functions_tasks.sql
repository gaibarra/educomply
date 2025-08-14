-- functions_tasks.sql
-- Definición de funciones RPC para marcar y reabrir tareas.
-- Ajusta nombres de tablas/campos según tu esquema real.
-- Ejecutar este archivo en el editor SQL de Supabase.

-- Asegura extensiones (UUID si corresponde)
create extension if not exists pgcrypto;

-- Función: mark_task_completed(task_id uuid)
-- Marca todas las sub_tareas como Completada; si no existen crea una genérica opcional.
create or replace function public.mark_task_completed(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Actualiza sub_tareas existentes
  update sub_tasks
     set status = 'Completada', updated_at = now()
  where task_id = mark_task_completed.p_task_id;

  if not found then
    -- Si no había sub_tareas, inserta una marca mínima (ajusta columnas obligatorias)
    -- IMPORTANTE: calificar el parámetro con el nombre de la función para evitar ambigüedad
    insert into sub_tasks (id, task_id, title, status, created_at)
  values (gen_random_uuid(), mark_task_completed.p_task_id, 'Marcado como cumplido', 'Completada', now());
  end if;

  -- (Opcional) Si tienes un campo status en tasks, descomenta:
  -- update tasks set scope = jsonb_set(coalesce(scope,'{}'::jsonb),'{"status"}','"Completada"', true)
  -- where id = mark_task_completed.p_task_id;
end;
$$;

grant execute on function public.mark_task_completed(uuid) to authenticated;
grant execute on function public.mark_task_completed(uuid) to service_role;

-- Función: reopen_task(task_id uuid)
create or replace function public.reopen_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sub_tasks
     set status = 'Pendiente', updated_at = now()
  where task_id = reopen_task.p_task_id;

  -- (Opcional) revertir status en tasks
  -- update tasks set scope = jsonb_set(coalesce(scope,'{}'::jsonb),'{"status"}','"Pendiente"', true)
  -- where id = reopen_task.p_task_id;
end;
$$;

grant execute on function public.reopen_task(uuid) to authenticated;
grant execute on function public.reopen_task(uuid) to service_role;

-- Recomendado: RLS en sub_tasks / tasks debe permitir a SECURITY DEFINER (propietario) operar.
-- Verifica el propietario de la función: debe ser el owner del schema public.
