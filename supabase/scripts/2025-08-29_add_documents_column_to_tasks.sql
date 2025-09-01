-- 2025-08-29_add_documents_column_to_tasks.sql
-- Agrega la columna 'documents' a la tabla 'tasks' si no existe

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS documents jsonb;
