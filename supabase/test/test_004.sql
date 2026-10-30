\set ON_ERROR_STOP 1
reset role;
update ideas set hidden = false;
select count(*) as queued_existing from ai_analysis where status = 'pending';
update ai_analysis set status = 'done', overall_score = 3.4;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
-- editing content re-queues; liking does not touch it
update ideas set pitch = 'better pitch';
select status from ai_analysis;
-- members cannot write analyses or claim jobs
do $$ begin
  update ai_analysis set overall_score = 5;
  if found then raise exception 'FAIL: bob wrote analysis'; end if;
end $$;
do $$ begin
  perform claim_analysis((select id from ideas limit 1), true);
  raise exception 'FAIL: bob claimed';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- new idea gets queued
insert into ideas (title, pitch) values ('Second', 'p');
-- settings: members read, cannot edit
select jsonb_array_length(criteria) as criteria_count, model from settings;
update settings set model = 'x';
-- profiles: own row only
insert into profiles (experience_text) values ('Bob CV');
do $$ begin
  insert into profiles (member_id, experience_text) select id, 'fake' from members where email = 'carol@x.com';
  raise exception 'FAIL: bob wrote carol profile';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- storage: own folder only
insert into storage.objects (bucket_id, name) select 'linkedin', current_member_id()::text || '/cv.pdf';
do $$ begin
  insert into storage.objects (bucket_id, name) values ('linkedin', gen_random_uuid()::text || '/cv.pdf');
  raise exception 'FAIL: bob uploaded to another folder';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- admin edits settings
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update settings set model = 'claude-sonnet-5-5', instructions = instructions || ' ';
select count(*) as admin_sees_cv from storage.objects;
-- outsider
select set_config('request.jwt.claim.sub', '', false);
select count(*) as outsider_analysis from ai_analysis;
-- server claims
reset role;
select claim_analysis(id, false) as first_claim, claim_analysis(id, false) as second_claim from ideas where title = 'Second';
select i.title, a.status from ideas i join ai_analysis a on a.idea_id = i.id order by 1;
select model from settings;
