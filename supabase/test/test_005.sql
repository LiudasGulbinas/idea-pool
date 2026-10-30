\set ON_ERROR_STOP 1
reset role;
delete from ideas;
insert into ideas (author_id, title, pitch, status) select id, 'A', 'p', 'shortlisted' from members where email = 'bob@x.com';
insert into ideas (author_id, title, pitch, status) select id, 'B', 'p', 'shortlisted' from members where email = 'bob@x.com';
insert into ideas (author_id, title, pitch, status) select id, 'C', 'p', 'new' from members where email = 'bob@x.com';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into votes (idea_id, points) select id, 3 from ideas where title = 'A';
insert into votes (idea_id, points) select id, 2 from ideas where title = 'B';
do $$ begin
  update votes set points = 3 where idea_id = (select id from ideas where title = 'B');
  raise exception 'FAIL: over budget';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ begin
  insert into votes (idea_id, points) select id, 1 from ideas where title = 'C';
  raise exception 'FAIL: voted on non-shortlisted';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ begin
  insert into votes (idea_id, member_id, points) select i.id, m.id, 1 from ideas i, members m where i.title = 'A' and m.email = 'bob@x.com';
  raise exception 'FAIL: carol voted as bob';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- moving points: lower A then raise B
update votes set points = 1 where idea_id = (select id from ideas where title = 'A');
update votes set points = 4 where idea_id = (select id from ideas where title = 'B');
-- bob cannot delete carol's vote
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
delete from votes;
select sum(points) as total_points_after_bob_delete from votes;
-- admin closes voting; carol cannot vote
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update settings set voting_open = false;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  update votes set points = 1 where idea_id = (select id from ideas where title = 'B');
  raise exception 'FAIL: voted while closed';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- admin resets all votes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update settings set voting_open = true;
delete from votes;
reset role;
select count(*) as votes_after_reset from votes;
