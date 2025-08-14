-- Cleanup old cross-referencing policies that cause recursive RLS

-- project_members (remove legacy and overlapping policies)
drop policy if exists "Users can manage project members" on public.project_members;
drop policy if exists "Users can view project members" on public.project_members;
drop policy if exists project_members_delete on public.project_members;
drop policy if exists project_members_insert on public.project_members;
drop policy if exists project_members_select on public.project_members;
drop policy if exists project_members_update on public.project_members;

-- Keep only our helper-based policies:
--   project_members_user_select, project_members_owner_insert, project_members_owner_update, project_members_owner_delete

-- projects (remove legacy and overlapping policies)
drop policy if exists "Users can create projects" on public.projects;
drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Users can view own projects" on public.projects;

-- Keep only our helper-based policies:
--   projects_owner_full, projects_members_select

-- Optional sanity: show remaining policies
-- select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies where tablename in ('projects','project_members');
