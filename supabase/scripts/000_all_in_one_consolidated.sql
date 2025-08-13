-- Consolidated setup & RLS / triggers / policies / indexes
-- Run order-safe: type, functions, tables, RLS enabling, policies, triggers, indexes.
-- Idempotent / defensive (safe to re-run on partially provisioned schema).

-- 0. Optional enum type for user roles (create only if absent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','director_campus','director_facultad','usuario');
  END IF;
END $$;

-- 1. Admin helper function
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from profiles p where p.id = uid and p.role = 'admin');
$$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- 2. Error logs table (observability)
create table if not exists public.error_logs (
  id bigserial primary key,
  context text,
  error jsonb,
  created_at timestamptz default now()
);
alter table public.error_logs enable row level security;
-- Policies error_logs
drop policy if exists error_logs_insert on public.error_logs;
create policy error_logs_insert on public.error_logs for insert
  with check (auth.role() in ('authenticated','service_role'));

drop policy if exists error_logs_select_admin on public.error_logs;
create policy error_logs_select_admin on public.error_logs for select
  using (public.is_admin(auth.uid()));

-- 3. Profiles RLS
alter table public.profiles enable row level security;
-- Drop previous profiles policies
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
  DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
  DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
  DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
  DROP POLICY IF EXISTS profiles_admin_access ON public.profiles;
END $$;
create policy profiles_self_select on public.profiles for select using (auth.uid() = id);
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);
create policy profiles_self_insert on public.profiles for insert with check (auth.uid() = id);
-- Renamed admin policy for clarity/access
create policy profiles_admin_access on public.profiles for all using (public.is_admin(auth.uid()));

-- 4. Tasks RLS (owner/responsible + admin override)
alter table public.tasks enable row level security;
DO $$ BEGIN
  DROP POLICY IF EXISTS tasks_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_update ON public.tasks;
  DROP POLICY IF EXISTS tasks_delete ON public.tasks;
END $$;
-- Use ::text casting to tolerate heterogeneous owner/responsible column types (uuid vs bigint)
create policy tasks_select on public.tasks for select using (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text OR responsible_person_id::text = auth.uid()::text
);
create policy tasks_insert on public.tasks for insert with check (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);
create policy tasks_update on public.tasks for update using (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
) with check (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);
create policy tasks_delete on public.tasks for delete using (
  public.is_admin(auth.uid()) OR owner_id::text = auth.uid()::text
);

DO $$
DECLARE
  has_subtasks boolean;
  link_col text;
  tasks_id_type text;
BEGIN
  SELECT to_regclass('public.sub_tasks') IS NOT NULL INTO has_subtasks;
  IF has_subtasks THEN
    -- Ensure sub_tasks.assigned_to_id exists (some clients request it). Assume uuid user ids.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sub_tasks' AND column_name='assigned_to_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.sub_tasks ADD COLUMN assigned_to_id uuid';
      BEGIN
        IF to_regclass('public.profiles') IS NOT NULL THEN
          EXECUTE 'ALTER TABLE public.sub_tasks ADD CONSTRAINT sub_tasks_assigned_to_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.profiles(id)';
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    -- Detect an existing linking column candidate
    SELECT column_name INTO link_col FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sub_tasks'
        AND column_name IN ('task_id','tasks_id','parent_task_id','taskid','task')
      ORDER BY CASE column_name
        WHEN 'task_id' THEN 1
        WHEN 'tasks_id' THEN 2
        WHEN 'parent_task_id' THEN 3
        WHEN 'taskid' THEN 4
        WHEN 'task' THEN 5 END
      LIMIT 1;

    -- Discover tasks.id type to create task_id column with matching type
    SELECT data_type INTO tasks_id_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='tasks' AND column_name='id';
    IF tasks_id_type IS NULL THEN
      tasks_id_type := 'bigint'; -- fallback
    ELSIF tasks_id_type = 'uuid' THEN
      tasks_id_type := 'uuid';
    ELSIF tasks_id_type LIKE 'integer%' THEN
      tasks_id_type := 'bigint'; -- treat integer as bigint for generality
    END IF;

    -- Ensure canonical task_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sub_tasks' AND column_name='task_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.sub_tasks ADD COLUMN task_id ' || tasks_id_type;
      -- If another link_col exists, backfill task_id from it (simple copy)
      IF link_col IS NOT NULL AND link_col <> 'task_id' THEN
        EXECUTE 'UPDATE public.sub_tasks SET task_id = ' || quote_ident(link_col) || ' WHERE task_id IS NULL';
      END IF;
      -- Add FK (best-effort)
      BEGIN
        EXECUTE 'ALTER TABLE public.sub_tasks ADD CONSTRAINT sub_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)';
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;

    EXECUTE 'ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sub_tasks_select ON public.sub_tasks';
    EXECUTE 'DROP POLICY IF EXISTS sub_tasks_modify ON public.sub_tasks';
    EXECUTE $POL$CREATE POLICY sub_tasks_select ON public.sub_tasks FOR SELECT USING (
      public.is_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = sub_tasks.task_id::text
          AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text)
      )
    )$POL$;
    EXECUTE $POL$CREATE POLICY sub_tasks_modify ON public.sub_tasks FOR ALL USING (
      public.is_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = sub_tasks.task_id::text
          AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text)
      )
    )$POL$;
  END IF;
END $$;

-- 6. Updated_at trigger for tasks
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tasks' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 6b. Documents & Comments RLS (only if tables exist). We reference sub_tasks -> tasks chain.
-- 6a. Ensure documents.sub_task_id and comments.sub_task_id are UUID columns to match sub_tasks.id
DO $$
DECLARE
  docs_exists boolean := to_regclass('public.documents') IS NOT NULL;
  comments_exists boolean := to_regclass('public.comments') IS NOT NULL;
  docs_type text;
  comments_type text;
  pol record;
BEGIN
  IF docs_exists THEN
    -- Drop any existing policies to allow altering column type
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='documents' LOOP
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.documents';
    END LOOP;
    EXECUTE 'ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY';
    SELECT data_type INTO docs_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='documents' AND column_name='sub_task_id';
    IF docs_type IS NOT NULL AND docs_type <> 'uuid' THEN
      -- For text/varchar: null out invalid UUIDs then cast
      IF docs_type IN ('text','character varying') THEN
        EXECUTE 'UPDATE public.documents SET sub_task_id = NULL WHERE sub_task_id !~* ' || quote_literal('^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$');
        EXECUTE 'ALTER TABLE public.documents ALTER COLUMN sub_task_id TYPE uuid USING (NULLIF(sub_task_id, '''')::uuid)';
      ELSIF docs_type IN ('integer','bigint','numeric') THEN
        -- For numeric: values cannot be UUID, set to NULL then convert
        EXECUTE 'UPDATE public.documents SET sub_task_id = NULL';
        EXECUTE 'ALTER TABLE public.documents ALTER COLUMN sub_task_id TYPE uuid USING (NULLIF(sub_task_id::text, '''')::uuid)';
      END IF;
    END IF;
    -- Re-enable RLS (policies will be recreated below)
    EXECUTE 'ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY';
  END IF;

  IF comments_exists THEN
    -- Drop any existing policies to allow altering column type
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='comments' LOOP
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.comments';
    END LOOP;
    EXECUTE 'ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY';
    SELECT data_type INTO comments_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comments' AND column_name='sub_task_id';
    IF comments_type IS NOT NULL AND comments_type <> 'uuid' THEN
      IF comments_type IN ('text','character varying') THEN
        EXECUTE 'UPDATE public.comments SET sub_task_id = NULL WHERE sub_task_id !~* ' || quote_literal('^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$');
        EXECUTE 'ALTER TABLE public.comments ALTER COLUMN sub_task_id TYPE uuid USING (NULLIF(sub_task_id, '''')::uuid)';
      ELSIF comments_type IN ('integer','bigint','numeric') THEN
        EXECUTE 'UPDATE public.comments SET sub_task_id = NULL';
        EXECUTE 'ALTER TABLE public.comments ALTER COLUMN sub_task_id TYPE uuid USING (NULLIF(sub_task_id::text, '''')::uuid)';
      END IF;
    END IF;
    -- Re-enable RLS (policies will be recreated below)
    EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 6b. Documents & Comments RLS (only if tables exist). We reference sub_tasks -> tasks chain.
DO $$
DECLARE
  has_documents boolean := to_regclass('public.documents') IS NOT NULL;
  has_comments boolean := to_regclass('public.comments') IS NOT NULL;
  has_sub_tasks boolean := to_regclass('public.sub_tasks') IS NOT NULL;
  sub_tasks_has_owner boolean := FALSE;
  sub_tasks_has_assigned boolean := FALSE;
  sub_tasks_actor_col text := NULL; -- either 'owner_id' or 'assigned_to_id'
  has_docs_sub_task boolean := FALSE;
  has_comments_sub_task boolean := FALSE;
  has_comments_author boolean := FALSE;
  doc_select_pred text;
  doc_modify_pred text;
  comments_select_pred text;
BEGIN
  IF has_sub_tasks THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sub_tasks' AND column_name='owner_id'
    ) INTO sub_tasks_has_owner;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sub_tasks' AND column_name='assigned_to_id'
    ) INTO sub_tasks_has_assigned;
    IF sub_tasks_has_owner THEN
      sub_tasks_actor_col := 'owner_id';
    ELSIF sub_tasks_has_assigned THEN
      sub_tasks_actor_col := 'assigned_to_id';
    ELSE
      sub_tasks_actor_col := NULL;
    END IF;
  END IF;

  IF has_documents THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='documents' AND column_name='sub_task_id'
    ) INTO has_docs_sub_task;
  END IF;
  IF has_comments THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comments' AND column_name='sub_task_id'
    ) INTO has_comments_sub_task;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comments' AND column_name='author_id'
    ) INTO has_comments_author;
  END IF;

  IF has_documents AND has_docs_sub_task THEN
    EXECUTE 'ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS documents_select ON public.documents';
    EXECUTE 'DROP POLICY IF EXISTS documents_modify ON public.documents';
    IF sub_tasks_actor_col IS NOT NULL THEN
      doc_select_pred := 'EXISTS (SELECT 1 FROM public.sub_tasks st WHERE st.id::text = documents.sub_task_id::text AND (st.' || sub_tasks_actor_col || '::text = auth.uid()::text OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id::text = st.task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text))))';
      doc_modify_pred := 'public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.sub_tasks st WHERE st.id::text = documents.sub_task_id::text AND (st.' || sub_tasks_actor_col || '::text = auth.uid()::text OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id::text = st.task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text))))';
    ELSE
      doc_select_pred := 'EXISTS (SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text WHERE st.id::text = documents.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text))';
      doc_modify_pred := 'public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text WHERE st.id::text = documents.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text))';
    END IF;
    EXECUTE 'CREATE POLICY documents_select ON public.documents FOR SELECT USING (' || doc_select_pred || ')';
    EXECUTE 'CREATE POLICY documents_modify ON public.documents FOR ALL USING (' || doc_modify_pred || ')';
  END IF;

  IF has_comments AND has_comments_sub_task THEN
    EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS comments_select ON public.comments';
    EXECUTE 'DROP POLICY IF EXISTS comments_modify ON public.comments';
    IF sub_tasks_actor_col IS NOT NULL THEN
      comments_select_pred := (CASE WHEN has_comments_author THEN 'author_id::text = auth.uid()::text OR ' ELSE '' END) ||
        'EXISTS (SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text WHERE st.id::text = comments.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text OR st.' || sub_tasks_actor_col || '::text = auth.uid()::text))';
    ELSE
      comments_select_pred := (CASE WHEN has_comments_author THEN 'author_id::text = auth.uid()::text OR ' ELSE '' END) ||
        'EXISTS (SELECT 1 FROM public.sub_tasks st JOIN public.tasks t ON t.id::text = st.task_id::text WHERE st.id::text = comments.sub_task_id::text AND (t.owner_id::text = auth.uid()::text OR t.responsible_person_id::text = auth.uid()::text))';
    END IF;
    EXECUTE 'CREATE POLICY comments_select ON public.comments FOR SELECT USING ( public.is_admin(auth.uid()) OR ' || comments_select_pred || ')';
    IF has_comments_author THEN
      EXECUTE 'CREATE POLICY comments_modify ON public.comments FOR ALL USING ( public.is_admin(auth.uid()) OR author_id::text = auth.uid()::text )';
    ELSE
      EXECUTE 'CREATE POLICY comments_modify ON public.comments FOR ALL USING ( public.is_admin(auth.uid()) )';
    END IF;
  END IF;
END $$;

-- 7. Recommended indexes
create index if not exists idx_tasks_owner on public.tasks(owner_id);
create index if not exists idx_tasks_responsible on public.tasks(responsible_person_id);
-- Create category index only if column exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tasks' AND column_name='category'
  ) THEN
    EXECUTE 'create index if not exists idx_tasks_category on public.tasks(category)';
  END IF;
END $$;
create index if not exists idx_tasks_due_date on public.tasks((scope->>'due_date'));
-- Create sub_tasks.task_id index only if table & column exist
DO $$ BEGIN
  IF to_regclass('public.sub_tasks') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sub_tasks' AND column_name='task_id'
  ) THEN
    EXECUTE 'create index if not exists idx_sub_tasks_task on public.sub_tasks(task_id)';
  END IF;
END $$;
-- Guarded index creation for comments.task_id
DO $$ BEGIN
  IF to_regclass('public.comments') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='comments' AND column_name='task_id'
  ) THEN
    EXECUTE 'create index if not exists idx_comments_task on public.comments(task_id)';
  END IF;
END $$;
-- Guarded index creation for comments.sub_task_id
DO $$ BEGIN
  IF to_regclass('public.comments') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='comments' AND column_name='sub_task_id'
  ) THEN
    EXECUTE 'create index if not exists idx_comments_subtask on public.comments(sub_task_id)';
  END IF;
END $$;
-- Guarded index creation for documents.sub_task_id
DO $$ BEGIN
  IF to_regclass('public.documents') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='sub_task_id'
  ) THEN
    EXECUTE 'create index if not exists idx_documents_subtask on public.documents(sub_task_id)';
  END IF;
END $$;

-- 8. (Optional) Clean legacy project-based artifacts (commented for safety)
-- ALTER TABLE public.tasks ALTER COLUMN project_id DROP NOT NULL;
-- ALTER TABLE public.tasks DROP COLUMN project_id;
-- DROP FUNCTION IF EXISTS public.is_member(uuid);
-- DROP TABLE IF EXISTS public.project_members;

-- 9. Diagnostics (uncomment to inspect policies)
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
-- SELECT * FROM pg_indexes WHERE schemaname='public' AND tablename IN ('tasks','sub_tasks');

-- End consolidated script
