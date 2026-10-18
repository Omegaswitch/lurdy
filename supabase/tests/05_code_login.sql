-- Code sign-in: 4-digit access codes, event codes for team members, throttling, expiry.
begin;

-- every participant has a unique, non-trivial 4-digit code
select tests.eq((select count(*) from public.participants where access_code !~ '^[0-9]{4}$' or access_code is null), 0::bigint, 'all participants have a code');
select tests.eq((select count(*) from public.participants where access_code ~ '^(\d)\1{3}$' or access_code in ('1234', '2345', '4321', '0123', '9876')), 0::bigint, 'no trivial codes');
do $$ begin
  for i in 1..300 loop
    insert into public.participants (edition_id, category, first_name, last_name) values (tests.id('e1'), 'pilgrim', 'Hromadný', 'Účastník ' || i);
  end loop;
end $$;
select tests.eq((select count(distinct access_code) from public.participants where edition_id = tests.id('e1')),
                (select count(*) from public.participants where edition_id = tests.id('e1')), 'codes unique in edition');
select tests.throws($$update public.participants set access_code = (select access_code from public.participants where id = tests.id('p4')) where id = tests.id('p3')$$, 'duplicate code refused', '23505');

-- only the service role (Edge Function) may run the sign-in check
select tests.login('a5');
select tests.throws($$select public.code_login_check('0000', null, '1.1.1.1')$$, 'participants cannot call the login check', '42501');
reset role;
select tests.anon();
select tests.throws($$select public.code_login_check('0000', null, '1.1.1.1')$$, 'anon cannot call the login check', '42501');
reset role;

create temp table c as select id, access_code from public.participants;
-- pilgrim: code alone
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), null, '10.0.0.1') ->> 'participant_id',
                tests.id('p3')::text, 'pilgrim signs in with code only');
-- team member: needs a currently valid event code of the same edition
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p1')), null, '10.0.0.2') ->> 'ok', 'false', 'staff without event code refused');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p1')), 'OLD000', '10.0.0.2') ->> 'ok', 'false', 'expired event code refused');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p1')), 'XYZ789', '10.0.0.2') ->> 'ok', 'false', 'other edition''s event code refused');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p1')), ' abc123 ', '10.0.0.2') ->> 'staff_code_id',
                tests.id('c1')::text, 'staff signs in with code + event code (case-insensitive)');
-- the answer for a wrong code and a wrong event code is identical
select tests.eq(public.code_login_check('0000', 'ABC123', '10.0.0.3'), public.code_login_check((select access_code from c where id = tests.id('p1')), 'WRONG1', '10.0.0.3'),
                'no hint which part was wrong');
-- suspended accounts and archived editions cannot sign in
update public.profiles set status = 'suspended' where id = tests.id('a5');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), null, '10.0.0.4') ->> 'ok', 'false', 'suspended refused');
update public.profiles set status = 'active' where id = tests.id('a5');
update public.editions set status = 'archived' where id = tests.id('e2');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p9')), null, '10.0.0.4') ->> 'ok', 'false', 'archived edition refused');

-- throttling: 5 failures for one code, or 10 from one IP, within 15 minutes
do $$ begin
  for i in 1..5 loop perform public.code_login_check((select access_code from c where id = tests.id('p1')), 'WRONG' || i, '10.0.1.' || i); end loop;
end $$;
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p1')), 'ABC123', '10.0.2.1') ->> 'reason', 'throttled', 'code locked after 5 failures, even with the right event code');
do $$ begin
  -- codes that belong to nobody
  perform public.code_login_check(lpad(g::text, 4, '0'), null, '10.0.3.3')
  from generate_series(0, 9999) g
  where not exists (select 1 from public.participants where access_code = lpad(g::text, 4, '0')) limit 10;
end $$;
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p7')), null, '10.0.3.3') ->> 'reason', 'throttled', 'IP blocked after 10 failures');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p7')), null, '10.0.3.4') ->> 'ok', 'true', 'other IPs still work');

-- linking a new auth user to a participant
insert into auth.users (id, email) values (tests.id('n1'), 'n1@example.test');
select public.code_login_link(tests.id('p7'), tests.id('n1'), null);
select tests.eq((select user_id from public.participants where id = tests.id('p7')), tests.id('n1'), 'participant linked to new account');
select tests.throws($$select public.code_login_link(tests.id('p7'), tests.id('a7'), null)$$, 'cannot relink to another account', '23505');

-- team rights lapse when the event code used at sign-in expires
update public.profiles set staff_code_id = tests.id('c0') where id = tests.id('a3');
select tests.login('a3');
select tests.eq(tests.n('select * from public.participants'), 1::bigint, 'staff with expired event code sees only self');
select tests.eq(public.scan_badge('LRD1.' || repeat('0', 32)) ->> 'result', 'not_authorized', 'and cannot scan');
reset role;
update public.profiles set staff_code_id = tests.id('c1') where id = tests.id('a3');
select tests.login('a3');
select tests.ok(tests.n('select * from public.participants') > 1, 'rights back after signing in with the current code');
reset role;

-- organisers suspend an account immediately; staff cannot
select tests.login('a3');
select tests.throws($$select public.set_account_status(tests.id('p3'), 'suspended')$$, 'staff cannot suspend', '42501');
reset role;
select tests.login('a1', 'aal2', 60);
select public.set_account_status(tests.id('p3'), 'suspended');
reset role;
select tests.eq((select status from public.profiles where id = tests.id('a5')), 'suspended', 'organiser suspended the pilgrim');

-- my_pilgrimage reports effective roles only
select tests.login('a4');
select tests.eq(public.my_pilgrimage() -> 'roles', '["assistant"]'::jsonb, 'assistant role reported');
reset role;
select tests.login('a1', 'aal1');
select tests.eq(public.my_pilgrimage() -> 'roles', '[]'::jsonb, 'organiser role not effective without MFA');
reset role;

rollback;
