-- Audit hardening: codes hidden from the API, throttle not usable against others, account link guarded,
-- lost-phone revocation, replay ownership, anon cannot execute functions.
begin;
create temp table c as select id, access_code, login_secret from public.participants;
grant select on c to authenticated, anon;

-- 1. access codes: no API role reads the column; organisers use the RPC; the scanner search returns no code
select tests.login('a3');
select tests.throws($$select access_code from public.participants$$, 'staff cannot read access codes', '42501');
select tests.eq(tests.n($$select id, first_name, last_name, phone from public.participants$$), 9::bigint, 'staff still read the operational columns');
select tests.ok(public.participant_access_code(tests.id('p3')) is null, 'staff get no code from the RPC');
select tests.throws($$select * from public.participant_access_codes(tests.id('e1'))$$, 'staff cannot export codes', '42501');
select tests.eq((select count(*) from public.find_participants(tests.id('e1'), 'poutnic')), 1::bigint, 'scanner finds by name, accent-insensitive');
select tests.eq((select count(*) from public.find_participants(tests.id('e1'), (select access_code from c where id = tests.id('p3')))), 1::bigint, 'scanner finds by exact code');
select tests.eq((select count(*) from public.find_participants(tests.id('e2'), 'a')), 0::bigint, 'no search in another edition');
reset role;
select tests.login('a4');
select tests.throws($$select access_code from public.participants where id = tests.id('p4')$$, 'carer cannot read the malade''s code', '42501');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq(public.participant_access_code(tests.id('p3')), (select access_code from c where id = tests.id('p3')), 'organiser reads one code');
select tests.eq((select count(*) from public.participant_access_codes(tests.id('e1'))), 9::bigint, 'organiser exports codes');
select tests.ok(public.participant_access_code(tests.id('p8')) is null, 'not for another edition');
update public.participants set phone = '+420 000 000 099' where id = tests.id('p3');
reset role;
select tests.eq(tests.n($$select * from audit.log where op = 'EXPORT_CODES' and actor = tests.id('a1')$$), 1::bigint, 'export is audited');
select tests.ok(not exists (select 1 from audit.log where row_id = tests.id('p3') and (old ? 'access_code' or new ? 'access_code')), 'audit rows carry no access code');
select tests.ok(not exists (select 1 from audit.login_attempts where ok and code is not null), 'successful sign-ins are logged without the code');

-- 2. throttling: a blocked address cannot lock a code, and throttled answers do not extend the block
do $$ begin
  -- thirty different codes that belong to nobody (the same wrong code five times trips the per-code limit first)
  perform public.code_login_check(lpad(g::text, 4, '0'), 'ZZZZZZZZ', null, '10.8.0.1')
  from generate_series(0, 9999) g
  where not exists (select 1 from public.participants where access_code = lpad(g::text, 4, '0')) limit 30;
end $$;
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select login_secret from c where id = tests.id('p3')), null, '10.8.0.1') ->> 'reason', 'throttled', 'address blocked after 30 wrong guesses');
do $$ begin
  for i in 1..6 loop perform public.code_login_check((select access_code from c where id = tests.id('p3')), (select login_secret from c where id = tests.id('p3')), null, '10.8.0.1'); end loop;
end $$;
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select login_secret from c where id = tests.id('p3')), null, '10.8.0.2') ->> 'ok', 'true', 'the blocked address did not lock p3''s code for others');
select tests.ok(not exists (select 1 from audit.login_attempts where ok and code is not null), 'successful sign-in logged without the code');

-- 3. the account link: an organiser cannot re-point a registration, sign-in can
select tests.login('a1', 'aal2', 60);
select tests.throws($$update public.participants set user_id = tests.id('a8') where id = tests.id('p7')$$, 'organiser cannot change user_id', '42501');
update public.participants set first_name = 'Změněné' where id = tests.id('p7');
select tests.eq((select first_name from public.participants where id = tests.id('p7')), 'Změněné', 'other columns still editable');
reset role;
insert into auth.users (id, email) values (tests.id('n2'), 'n2@example.test');
select public.code_login_link(tests.id('p7'), tests.id('n2'), null);
select tests.eq((select user_id from public.participants where id = tests.id('p7')), tests.id('n2'), 'sign-in links the account');

-- 4. lost phone: revoke_credential kills the digital code too; the phone learns it; suspended badges scan as revoked
create temp table qr (k text primary key, v text);
grant all on qr to authenticated;
select tests.login('a5');
insert into qr values ('d3', public.my_digital_credential());
select tests.ok(public.my_digital_credential_valid(), 'phone code valid after issue');
reset role;
select tests.login('a1', 'aal2', 60);
insert into qr values ('c3', public.issue_credential(tests.id('p3')));
select public.revoke_credential(tests.id('p3'), 'phone lost');
reset role;
select tests.login('a5');
select tests.ok(not public.my_digital_credential_valid(), 'phone learns its code is revoked');
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'd3')) ->> 'result', 'revoked', 'revoked digital code');
select tests.eq(public.scan_badge((select v from qr where k = 'c3')) ->> 'result', 'revoked', 'revoked card');
reset role;
select tests.login('a1', 'aal2', 60);
insert into qr values ('c3b', public.issue_credential(tests.id('p3')));
reset role;
update public.profiles set status = 'suspended' where id = tests.id('a5');
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'c3b')) ->> 'result', 'revoked', 'suspended account''s badge scans as revoked');
reset role;
update public.profiles set status = 'active' where id = tests.id('a5');
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'c3b')) ->> 'result', 'ok', 'valid again when reactivated');
reset role;
-- runaway client: at most 10 new phone codes a day
select tests.login('a5');
do $$ begin
  for i in 1..9 loop perform public.my_digital_credential(); end loop;
end $$;
select tests.throws($$select public.my_digital_credential()$$, 'eleventh phone code of the day refused', '54000');
reset role;

-- 5. replay of a manual action: only the caller's own, for the same person
select tests.login('a3');
select tests.eq(public.staff_action(tests.id('p3'), 'lookup', null, tests.id('r1')) ->> 'result', 'ok', 'manual lookup recorded');
select tests.eq(public.staff_action(tests.id('p4'), 'lookup', null, tests.id('r1')) ->> 'result', 'not_authorized', 'replay id with another person refused');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq(public.staff_action(tests.id('p3'), 'lookup', null, tests.id('r1')) ->> 'result', 'not_authorized', 'another user cannot replay it');
reset role;

-- 6. anon executes nothing in public
select tests.eq((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'EXECUTE')), 0::bigint, 'anon can execute no function');
select tests.anon();
select tests.throws($$select public.set_account_status(tests.id('p3'), 'suspended')$$, 'anon cannot call set_account_status', '42501');
reset role;

rollback;
