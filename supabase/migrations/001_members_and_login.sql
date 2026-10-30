-- Stage 1: members (also the allow-list), login guard, security rules.
-- Paste this whole file into Supabase > SQL Editor > Run.

create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users(id) on delete set null,
  email         text not null unique check (email = lower(email)),
  display_name  text,
  avatar_color  text not null default '#6366f1',
  role          text not null default 'member' check (role in ('member', 'admin')),
  created_at    timestamptz not null default now()
);

alter table public.members enable row level security;

-- Helpers used by every security rule in the app.
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin')
$$;

-- Lets the login page say "this email is not on the list" before sending a link.
create or replace function public.email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = lower(trim(p_email)))
$$;
grant execute on function public.email_allowed(text) to anon, authenticated;

-- Block sign-up for anyone not on the list, and link the login to the member row.
create or replace function public.guard_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where email = lower(new.email)) then
    raise exception 'This email is not on the Idea Pool member list';
  end if;
  return new;
end $$;

create or replace function public.link_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.members set user_id = new.id where email = lower(new.email);
  return new;
end $$;

drop trigger if exists idea_pool_guard_new_user on auth.users;
create trigger idea_pool_guard_new_user before insert on auth.users
  for each row execute function public.guard_new_auth_user();

drop trigger if exists idea_pool_link_new_user on auth.users;
create trigger idea_pool_link_new_user after insert on auth.users
  for each row execute function public.link_new_auth_user();

-- Members may change their own name and colour, but only admins change email/role.
-- (Runs as the caller, so internal system updates such as linking a first login are allowed.)
create or replace function public.guard_member_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() and (
       new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.user_id is distinct from old.user_id) then
    raise exception 'Only an admin can change email or role';
  end if;
  return new;
end $$;

drop trigger if exists members_guard_update on public.members;
create trigger members_guard_update before update on public.members
  for each row execute function public.guard_member_update();

-- Security rules
drop policy if exists "members: members can read" on public.members;
create policy "members: members can read" on public.members
  for select to authenticated using (public.is_member());

drop policy if exists "members: admin adds" on public.members;
create policy "members: admin adds" on public.members
  for insert to authenticated with check (public.is_admin());

drop policy if exists "members: self or admin edits" on public.members;
create policy "members: self or admin edits" on public.members
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "members: admin removes" on public.members;
create policy "members: admin removes" on public.members
  for delete to authenticated using (public.is_admin() and user_id is distinct from auth.uid());
