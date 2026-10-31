-- Invites: an invited account exists before its first login, so "joined" is tracked separately.

alter table public.members add column if not exists joined_at timestamptz;

update public.members m set joined_at = u.last_sign_in_at
  from auth.users u
 where u.id = m.user_id and m.joined_at is null and u.last_sign_in_at is not null;

create or replace function public.mark_member_joined() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null then
    update public.members set joined_at = new.last_sign_in_at
     where email = lower(new.email) and joined_at is null;
  end if;
  return new;
end $$;

drop trigger if exists idea_pool_mark_joined on auth.users;
create trigger idea_pool_mark_joined after insert or update of last_sign_in_at on auth.users
  for each row execute function public.mark_member_joined();

notify pgrst, 'reload schema';
