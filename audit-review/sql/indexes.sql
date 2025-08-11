-- Índices recomendados
create index if not exists idx_tasks_owner on public.tasks(owner_id);
create index if not exists idx_tasks_responsible on public.tasks(responsible_person_id);
create index if not exists idx_tasks_category on public.tasks(category);
create index if not exists idx_tasks_due_date on public.tasks((scope->>'due_date'));

create index if not exists idx_sub_tasks_task on public.sub_tasks(task_id);
create index if not exists idx_comments_task on public.comments(task_id);
create index if not exists idx_documents_subtask on public.documents(sub_task_id);
