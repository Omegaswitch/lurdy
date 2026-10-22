-- Admin sign-in: organiser and medical rights need a password session with the second factor; the code sign-in
-- (phone app, recorded as a one-time link) keeps only staff/assistant rights while the event code is valid.
begin;
-- a code session: the one-time link the code-login function turns into a session, then the authenticator
create function pg_temp.code_login(k text, aal text) returns void language plpgsql as $$
declare now_s bigint := extract(epoch from now())::bigint;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', tests.id(k), 'role', 'authenticated', 'aal', aal,
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', now_s - 600))
           || case when aal = 'aal2' then jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', now_s - 60)) else '[]'::jsonb end)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.code_login to authenticated;

-- organiser, password + authenticator: full organiser rights
select tests.login('a1', 'aal2', 60);
select tests.ok(app.is_organizer(tests.id('e1')), 'organiser with password + authenticator is an organiser');
select tests.eq((select count(*) from public.participant_access_codes(tests.id('e1'))), 9::bigint, 'and may export sign-in codes');
reset role;

-- the same organiser through the code sign-in, even with the authenticator: no organiser rights
select pg_temp.code_login('a1', 'aal2');
select tests.ok(not app.is_organizer(tests.id('e1')), 'code session is never an organiser');
select tests.throws($$select * from public.participant_access_codes(tests.id('e1'))$$, 'code session cannot export codes', '42501');
select tests.ok(public.my_admin_grant(), 'the setup screen still knows this person holds an organiser grant');
-- and none through the table rules either (they use the set form, app.edition_ids)
select tests.eq((select count(*) from app.edition_ids('{organizer,medical}')), 0::bigint, 'code session: no organiser edition in the table rules');
select tests.eq(tests.n($$select id from public.participants$$), 1::bigint, 'code session sees only its own participant row');
select tests.throws($$insert into public.rooms (edition_id, facility_id, number, capacity) select edition_id, id, 'X1', 1 from public.facilities limit 1$$,
  'code session cannot create a room', '42501');
reset role;

-- medical: same rule
select tests.login('a2', 'aal2', 60);
select tests.ok(app.is_medical(tests.id('e1')), 'medical with password + authenticator');
reset role;
select pg_temp.code_login('a2', 'aal2');
select tests.ok(not app.is_medical(tests.id('e1')), 'medical through the code sign-in: no medical rights');
reset role;

-- organisers no longer depend on the event code; staff still do
update public.staff_codes set valid_until = now() - interval '1 hour' where id = tests.id('c1');
select tests.login('a1', 'aal2', 60);
select tests.ok(app.is_organizer(tests.id('e1')), 'organiser keeps rights after the event code expired (password session)');
select tests.eq(tests.n($$select id from public.participants where edition_id = tests.id('e1')$$), 9::bigint, 'and still reads every participant through the table rules');
reset role;
select tests.login('a3', 'aal2', 60);
select tests.ok(not app.is_staff(tests.id('e1')), 'staff lose rights when the event code expired, even with a password');
reset role;
update public.staff_codes set valid_until = now() + interval '1 day' where id = tests.id('c1');
select pg_temp.code_login('a3', 'aal1');
select tests.ok(app.is_staff(tests.id('e1')), 'staff in the phone app (code sign-in, valid event code) keep their rights');
reset role;

-- someone without an admin grant
select tests.login('a5', 'aal2', 60);
select tests.ok(not public.my_admin_grant(), 'a pilgrim has no admin grant');
reset role;
select tests.anon();
select tests.throws($$select public.my_admin_grant()$$, 'anon cannot call my_admin_grant', '42501');
reset role;

-- the super admin (master access): password + authenticator, never through a code session
select tests.login('a0', 'aal2', 60);
select tests.ok(app.is_super_admin(), 'super admin with password + authenticator');
reset role;
select pg_temp.code_login('a0', 'aal2');
select tests.ok(not app.is_super_admin(), 'a code session is never super admin');
select tests.ok(not app.is_organizer(tests.id('e1')), 'and gets no organiser rights through it');
reset role;

rollback;
