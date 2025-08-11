-- RLS tasks con admin override y dueños/responsables
alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

create policy tasks_select on public.tasks for select
using (
  public.is_admin(auth.uid())
  or owner_id = auth.uid()
  or responsible_person_id = auth.uid()
);

create policy tasks_insert on public.tasks for insert
with check (public.is_admin(auth.uid()) or owner_id = auth.uid());

create policy tasks_update on public.tasks for update
using (public.is_admin(auth.uid()) or owner_id = auth.uid())
with check (public.is_admin(auth.uid()) or owner_id = auth.uid());

create policy tasks_delete on public.tasks for delete
using (public.is_admin(auth.uid()) or owner_id = auth.uid());
