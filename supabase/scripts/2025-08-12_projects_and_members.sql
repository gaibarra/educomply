-- Create projects and project_members with basic RLS

create extension if not exists "uuid-ossp";

-- 1) projects table
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

-- 2) project_members table
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamp with time zone not null default now(),
  primary key (project_id, user_id)
);

-- 3) Enable RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- 4) Helpers (use SECURITY DEFINER to avoid RLS recursion)
create or replace function public.is_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.owner_id = auth.uid()
  );
$$;

-- 5) RLS Policies
-- Projects: owner can full access; members can select (via helper to avoid recursion)
drop policy if exists projects_owner_full on public.projects;
drop policy if exists projects_members_select on public.projects;

create policy projects_owner_full on public.projects
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy projects_members_select on public.projects
  for select using (
    auth.uid() = owner_id or public.is_member(projects.id)
  );

-- Project members: use helper to check ownership; avoid direct subqueries to projects
drop policy if exists project_members_user_select on public.project_members;
drop policy if exists project_members_owner_insert on public.project_members;
drop policy if exists project_members_owner_update on public.project_members;
drop policy if exists project_members_owner_delete on public.project_members;

create policy project_members_user_select on public.project_members
  for select using (
    user_id = auth.uid() or public.is_project_owner(project_members.project_id)
  );

create policy project_members_owner_insert on public.project_members
  for insert with check (public.is_project_owner(project_members.project_id));

create policy project_members_owner_update on public.project_members
  for update using (public.is_project_owner(project_members.project_id))
  with check (public.is_project_owner(project_members.project_id));

create policy project_members_owner_delete on public.project_members
  for delete using (public.is_project_owner(project_members.project_id));

-- 6) Keep owner always member with role 'owner' via trigger
create or replace function public.ensure_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_members(project_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (project_id, user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_owner_membership on public.projects;
create trigger trg_projects_owner_membership
  after insert on public.projects
  for each row execute function public.ensure_owner_membership();

-- 7) Ownership and permissions (Supabase roles)
-- Ensure functions are owned by table owner (usually postgres) so SECURITY DEFINER bypasses RLS
do $$
begin
  begin execute 'alter function public.is_member(uuid) owner to postgres'; exception when others then null; end;
  begin execute 'alter function public.is_project_owner(uuid) owner to postgres'; exception when others then null; end;
  begin execute 'alter function public.ensure_owner_membership() owner to postgres'; exception when others then null; end;
end $$;

-- Allow authenticated users to use tables subject to RLS
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_members to authenticated;

-- Allow calling helper functions from authenticated role
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;

-- 8) Email lookup helper for autocomplete (SECURITY DEFINER reads auth.users)
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

do $$
begin
  begin execute 'alter function public.get_user_id_by_email(text) owner to postgres'; exception when others then null; end;
end $$;

grant execute on function public.get_user_id_by_email(text) to authenticated;

-- 9) Email autocomplete: list emails by prefix (SECURITY DEFINER)
create or replace function public.search_user_emails(p_prefix text)
returns table(email text, id uuid)
language sql
stable
security definer
set search_path = public, auth as $$
  select u.email, u.id
  from auth.users u
  where u.email ilike p_prefix || '%'
  order by u.email
  limit 10;
$$;

do $$
begin
  begin execute 'alter function public.search_user_emails(text) owner to postgres'; exception when others then null; end;
end $$;

grant execute on function public.search_user_emails(text) to authenticated;
