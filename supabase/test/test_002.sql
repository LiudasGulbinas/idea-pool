\set ON_ERROR_STOP 1
-- reuses members from test_001: admin@x.com (a), bob@x.com (b, now admin), carol (not logged in)
reset role;
update members set role = 'member' where email = 'bob@x.com';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'carol@x.com');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into ideas (title, pitch, tags, status, hidden) values ('Bob idea', 'pitch', '{fintech}', 'chosen', true);
select title, status, hidden from ideas; -- forced to new / visible
do $$ begin
  insert into ideas (author_id, title, pitch) select id, 'fake', 'p' from members where email = 'carol@x.com';
  raise exception 'FAIL: bob posted as carol';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
update ideas set problem = 'big problem' where title = 'Bob idea';
do $$ begin
  update ideas set status = 'chosen' where title = 'Bob idea';
  raise exception 'FAIL: bob changed status';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- carol cannot edit bob's idea
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update ideas set title = 'hacked';
delete from ideas;
select count(*) as carol_sees, max(title) as title from ideas;
-- admin shortlists and hides
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update ideas set status = 'shortlisted', hidden = true;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select count(*) as carol_sees_hidden from ideas;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select count(*) as author_sees_own_hidden from ideas;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as outsider_sees from ideas;
reset role;
select title, problem, status, hidden from ideas;
