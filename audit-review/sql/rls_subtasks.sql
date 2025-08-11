-- RLS sub_tasks con visibilidad por pertenencia a la tarea
alter table public.sub_tasks enable row level security;

drop policy if exists sub_tasks_select on public.sub_tasks;
drop policy if exists sub_tasks_modify on public.sub_tasks;

create policy sub_tasks_select on public.sub_tasks for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.tasks t
    where t.id = sub_tasks.task_id
      and (t.owner_id = auth.uid() or t.responsible_person_id = auth.uid())
  )
);

create policy sub_tasks_modify on public.sub_tasks for all
using (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.tasks t
    where t.id = sub_tasks.task_id
      and (t.owner_id = auth.uid() or t.responsible_person_id = auth.uid())
  )
);
