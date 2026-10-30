\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update members set avatar_url = 'https://x/a.png', intro_seen_at = now() where email = 'carol@x.com';
update members set avatar_url = 'https://x/hack.png' where email = 'bob@x.com'; -- not hers: 0 rows
insert into storage.objects (bucket_id, name) select 'avatars', current_member_id()::text || '/a.png';
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars', gen_random_uuid()::text || '/a.png');
  raise exception 'FAIL: wrote another folder';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
reset role;
select email, avatar_url, intro_seen_at is not null as seen from members order by email;
