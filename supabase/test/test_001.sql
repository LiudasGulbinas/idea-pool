\set ON_ERROR_STOP 1
insert into public.members (email, role) values ('admin@x.com', 'admin'), ('bob@x.com', 'member');
-- non-allowed sign-up must fail
do $$ begin
  insert into auth.users (email) values ('eve@x.com');
  raise exception 'FAIL: eve was allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'Admin@x.com'), ('00000000-0000-0000-0000-00000000000b', 'bob@x.com');
select email, user_id is not null as linked from members order by email;
select public.email_allowed(' BOB@x.com ') as bob_allowed, public.email_allowed('eve@x.com') as eve_allowed;

set role authenticated;
-- bob
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select count(*) as bob_sees from members;
update members set display_name = 'Bob' where email = 'bob@x.com';
do $$ begin
  update members set role = 'admin' where email = 'bob@x.com';
  raise exception 'FAIL: bob became admin';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
update members set display_name = 'hacked' where email = 'admin@x.com'; -- silently 0 rows
do $$ begin
  insert into members (email) values ('x@x.com');
  raise exception 'FAIL: bob inserted';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into members (email) values ('carol@x.com');
update members set role = 'admin' where email = 'bob@x.com';
-- anonymous / outsider
select set_config('request.jwt.claim.sub', '', false);
select count(*) as outsider_sees from members;
reset role;
select email, display_name, role from members order by email;
