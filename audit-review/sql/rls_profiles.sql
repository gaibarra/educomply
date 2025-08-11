-- RLS para profiles sin recursión (usa SECURITY DEFINER)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from profiles p where p.id = uid and p.role = 'admin');
$$;

revoke all on function public.is_admin from public;
grant execute on function public.is_admin to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_self_select
on public.profiles for select
using (auth.uid() = id);

create policy profiles_self_update
on public.profiles for update
using (auth.uid() = id);

create policy profiles_self_insert
on public.profiles for insert
with check (auth.uid() = id);

-- Acceso total para admin
create policy profiles_admin_all
on public.profiles for all
using (public.is_admin(auth.uid()));
