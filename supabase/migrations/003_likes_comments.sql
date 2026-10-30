-- Stage 3: likes and comments.

create table if not exists public.likes (
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  member_id  uuid not null default public.current_member_id() references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, member_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  author_id  uuid not null default public.current_member_id() references public.members(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_idea_idx on public.comments (idea_id, created_at);

alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- Comment edits keep their author and idea; edited time is tracked.
create or replace function public.guard_comment_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.author_id is distinct from old.author_id or new.idea_id is distinct from old.idea_id then
    raise exception 'A comment cannot be moved to another author or idea';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists comments_guard_update on public.comments;
create trigger comments_guard_update before update on public.comments
  for each row execute function public.guard_comment_update();

-- Likes: everyone in the group sees them; you can only add or remove your own.
drop policy if exists "likes: members read" on public.likes;
create policy "likes: members read" on public.likes for select to authenticated
  using (public.is_member() and exists (select 1 from public.ideas i where i.id = idea_id));
drop policy if exists "likes: like as yourself" on public.likes;
create policy "likes: like as yourself" on public.likes for insert to authenticated
  with check (member_id = public.current_member_id() and exists (select 1 from public.ideas i where i.id = idea_id));
drop policy if exists "likes: unlike your own" on public.likes;
create policy "likes: unlike your own" on public.likes for delete to authenticated
  using (member_id = public.current_member_id());

-- Comments: visible with their idea; authors edit/delete their own, admin can delete any.
drop policy if exists "comments: members read" on public.comments;
create policy "comments: members read" on public.comments for select to authenticated
  using (public.is_member() and exists (select 1 from public.ideas i where i.id = idea_id));
drop policy if exists "comments: comment as yourself" on public.comments;
create policy "comments: comment as yourself" on public.comments for insert to authenticated
  with check (author_id = public.current_member_id() and exists (select 1 from public.ideas i where i.id = idea_id));
drop policy if exists "comments: author edits" on public.comments;
create policy "comments: author edits" on public.comments for update to authenticated
  using (author_id = public.current_member_id())
  with check (author_id = public.current_member_id());
drop policy if exists "comments: author or admin deletes" on public.comments;
create policy "comments: author or admin deletes" on public.comments for delete to authenticated
  using (author_id = public.current_member_id() or public.is_admin());

grant select, insert, delete on public.likes to authenticated;
grant select, insert, update, delete on public.comments to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.likes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
