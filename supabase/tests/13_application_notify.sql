-- The list of addresses told about new applications: only a super admin (password + authenticator) reads or edits it.
begin;
select tests.login('a0', 'aal2', 60);
insert into public.application_notify (email) values ('koordinator@example.test'), ('prihlasky@example.test');
select tests.eq(tests.n($$select * from public.application_notify$$), 2::bigint, 'super admin adds and reads addresses');
select tests.throws($$insert into public.application_notify (email) values ('Velka@Example.test')$$, 'addresses are stored lower-case', '23514');
select tests.throws($$insert into public.application_notify (email) values ('not an address')$$, 'only e-mail addresses', '23514');
delete from public.application_notify where email = 'prihlasky@example.test';
select tests.eq(tests.n($$select * from public.application_notify$$), 1::bigint, 'super admin removes an address');
reset role;
select tests.ok(exists (select 1 from audit.log where table_name = 'application_notify' and op = 'DELETE'), 'changes are audited');

-- organiser (even with password + authenticator), medical, staff, pilgrim, anon: nothing
select tests.login('a1', 'aal2', 60);
select tests.eq(tests.n($$select * from public.application_notify$$), 0::bigint, 'organiser does not see the list');
select tests.throws($$insert into public.application_notify (email) values ('x@example.test')$$, 'organiser cannot add', '42501');
delete from public.application_notify;
reset role;
select tests.eq((select count(*) from public.application_notify), 1::bigint, 'organiser removed nothing');
select tests.login('a3', 'aal2', 60);
select tests.eq(tests.n($$select * from public.application_notify$$), 0::bigint, 'staff does not see the list');
reset role;
select tests.login('a5');
select tests.eq(tests.n($$select * from public.application_notify$$), 0::bigint, 'pilgrim does not see the list');
reset role;
select tests.anon();
select tests.throws($$select * from public.application_notify$$, 'anon cannot read the list', '42501');
reset role;
-- the super admin without the authenticator: nothing
select tests.login('a0');
select tests.eq(tests.n($$select * from public.application_notify$$), 0::bigint, 'super admin without MFA sees nothing');
reset role;
rollback;
