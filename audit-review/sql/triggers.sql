-- Trigger updated_at
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='updated_at') then
    alter table public.tasks add column updated_at timestamptz default now();
  end if;
end $$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_current_timestamp_updated_at();
