\set ON_ERROR_STOP 1
-- state from earlier tests: one hidden idea by bob; admin a, bob b, carol c
reset role;
update ideas set hidden = false;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into likes (idea_id) select id from ideas;
do $$ begin
  insert into likes (idea_id) select id from ideas;
  raise exception 'FAIL: double like';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ begin
  insert into likes (idea_id, member_id) select i.id, m.id from ideas i, members m where m.email = 'bob@x.com';
  raise exception 'FAIL: carol liked as bob';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
insert into comments (idea_id, body) select id, 'Nice one' from ideas;
-- bob cannot edit or delete carol's comment, cannot remove her like
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update comments set body = 'hacked';
delete from comments;
delete from likes;
insert into comments (idea_id, body) select id, 'Thanks!' from ideas;
select count(*) as bob_sees_comments, (select count(*) from likes) as bob_sees_likes from comments;
-- carol edits own comment
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update comments set body = 'Nice one (edited)' where body = 'Nice one';
-- admin hides idea: carol no longer sees its comments
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
delete from comments where body = 'Thanks!';
update ideas set hidden = true;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select count(*) as carol_sees_comments_on_hidden from comments;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as outsider_likes from likes;
reset role;
select body from comments;
select count(*) as likes from likes;
