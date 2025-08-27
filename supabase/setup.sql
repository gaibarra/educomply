-- Supabase schema additions for storing generated documents
-- Creates extension, table and a helper insert function

-- Ensure uuid_generate_v4 is available (uuid-ossp provides uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- Table: documents
create table if not exists public.documents (
	id uuid default uuid_generate_v4() primary key,
	created_at timestamptz default timezone('utc'::text, now()) not null,
	created_by uuid references auth.users(id) on delete set null,
	title text,
	filename text,
	summary text,
	body_markdown text,
	metadata jsonb,
	task_id uuid references public.tasks(id) on delete set null,
	is_active boolean default true
);

-- Optional function to insert a document (returns the inserted row)
create or replace function public.insert_document(
	p_title text,
	p_filename text,
	p_summary text,
	p_body_markdown text,
	p_metadata jsonb,
	p_task_id uuid,
	p_user uuid
)
returns setof public.documents as $$
begin
	return query
		insert into public.documents (title, filename, summary, body_markdown, metadata, task_id, created_by)
		values (p_title, p_filename, p_summary, p_body_markdown, p_metadata, p_task_id, p_user)
		returning *;
end;
$$ language plpgsql security definer;

-- Note: consider adding RLS policies to allow authenticated users to insert/select their documents
-- Migration: add task-based one-to-many relation and columns expected by insert_document RPC
-- This migration will:
-- 1. add columns (title, filename, summary, body_markdown, metadata, task_id, created_by, is_active)
-- 2. if documents.sub_task_id exists, try to populate task_id from sub_tasks.task_id
-- 3. leave sub_task_id intact (so you can verify) — comment includes optional drop

BEGIN;

ALTER TABLE public.documents
	ADD COLUMN IF NOT EXISTS title text,
	ADD COLUMN IF NOT EXISTS filename text,
	ADD COLUMN IF NOT EXISTS summary text,
	ADD COLUMN IF NOT EXISTS body_markdown text,
	ADD COLUMN IF NOT EXISTS metadata jsonb,
	ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- If documents currently reference sub_tasks, copy the task relation where possible.
-- This assumes there is a table public.sub_tasks with columns id (uuid) and task_id (uuid).
-- Run the UPDATE only if sub_task_id exists in documents.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='sub_task_id') THEN
		-- attempt best-effort migration: set task_id based on sub_tasks.task_id
		EXECUTE 'UPDATE public.documents d SET task_id = s.task_id FROM public.sub_tasks s WHERE s.id = d.sub_task_id';
	END IF;
END$$;

COMMIT;

-- Optional: after verifying migration, you can DROP the sub_task_id column if it's no longer needed:
-- ALTER TABLE public.documents DROP COLUMN IF EXISTS sub_task_id;

-- Ensure existing sub_task_id constraint won't block task-based inserts: make it nullable if present
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='sub_task_id') THEN
		EXECUTE 'ALTER TABLE public.documents ALTER COLUMN sub_task_id DROP NOT NULL';
	END IF;
END$$;

-- If older schema has non-null legacy columns, make them nullable so new inserts using title/filename don't fail.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='name') THEN
		EXECUTE 'ALTER TABLE public.documents ALTER COLUMN name DROP NOT NULL';
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='storage_path') THEN
		EXECUTE 'ALTER TABLE public.documents ALTER COLUMN storage_path DROP NOT NULL';
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='url') THEN
		EXECUTE 'ALTER TABLE public.documents ALTER COLUMN url DROP NOT NULL';
	END IF;
END$$;