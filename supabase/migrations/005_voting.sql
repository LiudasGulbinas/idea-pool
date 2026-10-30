-- Stage 5: voting on shortlisted ideas.

alter table public.settings add column if not exists vote_budget int not null default 5 check (vote_budget between 1 and 50);
alter table public.settings add column if not exists voting_open boolean not null default true;

create table if not exists public.votes (
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  member_id  uuid not null default public.current_member_id() references public.members(id) on delete cascade,
  points     int not null check (points > 0),
  updated_at timestamptz not null default now(),
  primary key (idea_id, member_id)
);

alter table public.votes enable row level security;

-- Votes go only to shortlisted (or chosen) ideas, while voting is open, within each member's point budget.
create or replace function public.guard_vote() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  used int;
begin
  select * into s from public.settings where id = 1;
  if not s.voting_open then
    raise exception 'Voting is closed';
  end if;
  if not exists (select 1 from public.ideas where id = new.idea_id and status in ('shortlisted', 'chosen')) then
    raise exception 'You can only vote for shortlisted ideas';
  end if;
  select coalesce(sum(v.points), 0) into used
    from public.votes v join public.ideas i on i.id = v.idea_id
   where v.member_id = new.member_id and i.status in ('shortlisted', 'chosen') and v.idea_id <> new.idea_id;
  if used + new.points > s.vote_budget then
    raise exception 'Not enough points left (you have % of %)', s.vote_budget - used, s.vote_budget;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists votes_guard on public.votes;
create trigger votes_guard before insert or update on public.votes
  for each row execute function public.guard_vote();

drop policy if exists "votes: members read" on public.votes;
create policy "votes: members read" on public.votes for select to authenticated
  using (public.is_member() and exists (select 1 from public.ideas i where i.id = idea_id));
drop policy if exists "votes: vote as yourself" on public.votes;
create policy "votes: vote as yourself" on public.votes for insert to authenticated
  with check (member_id = public.current_member_id());
drop policy if exists "votes: change own vote" on public.votes;
create policy "votes: change own vote" on public.votes for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
drop policy if exists "votes: remove own vote or admin resets" on public.votes;
create policy "votes: remove own vote or admin resets" on public.votes for delete to authenticated
  using (member_id = public.current_member_id() or public.is_admin());

grant select, insert, update, delete on public.votes to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.settings;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
