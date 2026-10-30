-- Stage 2: ideas, with live updates.

create table if not exists public.ideas (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null default public.current_member_id() references public.members(id) on delete cascade,
  title            text not null check (length(trim(title)) between 1 and 120),
  pitch            text not null check (length(trim(pitch)) between 1 and 200),
  problem          text not null default '',
  solution         text not null default '',
  target_customer  text not null default '',
  revenue_model    text not null default '',
  tags             text[] not null default '{}',
  status           text not null default 'new' check (status in ('new', 'shortlisted', 'parked', 'chosen')),
  hidden           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ideas_created_at_idx on public.ideas (created_at desc);

alter table public.ideas enable row level security;

-- Authors edit their content; only admins change status, visibility or authorship.
create or replace function public.guard_idea_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() and (
       new.status is distinct from old.status
    or new.hidden is distinct from old.hidden
    or new.author_id is distinct from old.author_id) then
    raise exception 'Only an admin can change status or hide ideas';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ideas_guard_update on public.ideas;
create trigger ideas_guard_update before update on public.ideas
  for each row execute function public.guard_idea_update();

-- New ideas always start as 'new' and visible, whoever posts them.
create or replace function public.guard_idea_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.status := 'new';
    new.hidden := false;
  end if;
  return new;
end $$;

drop trigger if exists ideas_guard_insert on public.ideas;
create trigger ideas_guard_insert before insert on public.ideas
  for each row execute function public.guard_idea_insert();

drop policy if exists "ideas: members read" on public.ideas;
create policy "ideas: members read" on public.ideas
  for select to authenticated
  using (public.is_member() and (not hidden or author_id = public.current_member_id() or public.is_admin()));

drop policy if exists "ideas: members post as themselves" on public.ideas;
create policy "ideas: members post as themselves" on public.ideas
  for insert to authenticated
  with check (public.is_member() and author_id = public.current_member_id());

drop policy if exists "ideas: author or admin edits" on public.ideas;
create policy "ideas: author or admin edits" on public.ideas
  for update to authenticated
  using (author_id = public.current_member_id() or public.is_admin())
  with check (author_id = public.current_member_id() or public.is_admin());

drop policy if exists "ideas: author or admin deletes" on public.ideas;
create policy "ideas: author or admin deletes" on public.ideas
  for delete to authenticated
  using (author_id = public.current_member_id() or public.is_admin());

grant select, insert, update, delete on public.ideas to authenticated;

-- Live updates
do $$ begin
  alter publication supabase_realtime add table public.ideas;
exception when duplicate_object then null;
end $$;
