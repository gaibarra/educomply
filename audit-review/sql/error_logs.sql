-- Tabla simple para observabilidad de errores en frontend/edge
create table if not exists public.error_logs (
  id bigserial primary key,
  context text,
  error jsonb,
  created_at timestamptz default now()
);

alter table public.error_logs enable row level security;

drop policy if exists error_logs_insert on public.error_logs;
create policy error_logs_insert on public.error_logs for insert
with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists error_logs_select_admin on public.error_logs;
create policy error_logs_select_admin on public.error_logs for select
using (public.is_admin(auth.uid()));
