-- reminders.sql
-- Tabla de recordatorios para tareas. Ejecutar en el editor SQL de Supabase.
-- Crea tabla, índices y políticas RLS básicas.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  remind_at timestamptz null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

-- Index para consultas por usuario y fecha
create index if not exists reminders_user_time_idx on public.reminders(user_id, remind_at);
create index if not exists reminders_task_idx on public.reminders(task_id);

-- Habilitar RLS si no estaba
alter table public.reminders enable row level security;

-- Nota: CREATE POLICY no soporta IF NOT EXISTS; usamos DROP + CREATE idempotente.
drop policy if exists "reminders_select_own" on public.reminders;
drop policy if exists "reminders_insert_own" on public.reminders;
drop policy if exists "reminders_update_own" on public.reminders;
drop policy if exists "reminders_delete_own" on public.reminders;

create policy "reminders_select_own" on public.reminders for select using (auth.uid() = user_id);
create policy "reminders_insert_own" on public.reminders for insert with check (auth.uid() = user_id);
create policy "reminders_update_own" on public.reminders for update using (auth.uid() = user_id);
create policy "reminders_delete_own" on public.reminders for delete using (auth.uid() = user_id);

-- Opcional: expiración / limpieza automática podría hacerse con una tarea programada externa.
