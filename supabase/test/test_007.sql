\set ON_ERROR_STOP 1
reset role;
insert into members (email) values ('dana@x.com');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'dana@x.com'); -- invited, not logged in
select email, user_id is not null as linked, joined_at is not null as joined from members where email = 'dana@x.com';
update auth.users set last_sign_in_at = now() where email = 'dana@x.com'; -- first real login
select email, joined_at is not null as joined from members where email = 'dana@x.com';
-- joined_at is the first login, not overwritten later
update auth.users set last_sign_in_at = now() + interval '1 day' where email = 'dana@x.com';
select (joined_at < now() + interval '1 hour') as kept_first_login from members where email = 'dana@x.com';
