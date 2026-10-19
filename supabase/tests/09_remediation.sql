-- Remediation of 2026-10-19: invitation code, retention, integrity, pending badges, incident fence, policy rewrite.
begin;
create temp table c as select id, access_code, login_secret from public.participants;
grant select on c to authenticated, anon;

-- A. sign-in needs both codes; neither is readable through the API
select tests.eq((select count(*) from public.participants where login_secret !~ '^[A-Z2-9]{8}$'), 0::bigint, 'everyone has an 8-character invitation code');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select login_secret from c where id = tests.id('p3')), null, '10.9.1.1') ->> 'ok', 'true', 'number + invitation code signs in');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), lower('ab-cd ' || (select substr(login_secret, 5) from c where id = tests.id('p3'))), null, '10.9.1.1') ->> 'ok', 'false', 'wrong invitation code refused');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select 'ab-' || substr(login_secret, 1, 3) || ' ' || substr(login_secret, 4) from c where id = tests.id('p3')), null, '10.9.1.2') ->> 'ok',
                case when (select login_secret from c where id = tests.id('p3')) like 'AB%' then 'true' else 'false' end, 'hyphens, spaces and case are ignored');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), replace((select login_secret from c where id = tests.id('p3')), '', ''), null, '10.9.1.3') ->> 'ok', 'true', 'plain code still works');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), null, '10.9.1.4') ->> 'ok', 'false', 'the old number-only check is dead');
select tests.login('a3');
select tests.throws($$select login_secret from public.participants$$, 'staff cannot read invitation codes', '42501');
select tests.ok(public.participant_login(tests.id('p3')) is null, 'staff get no codes from the RPC');
select tests.throws($$select public.reset_login_secret(tests.id('p3'))$$, 'staff cannot reset codes', '42501');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq(public.participant_login(tests.id('p3')) ->> 'login_secret', (select login_secret from c where id = tests.id('p3')), 'organiser reads both codes');
select tests.eq((select count(*) from public.participant_logins(tests.id('e1'))), 9::bigint, 'organiser exports both codes');
create temp table newsecret as select public.reset_login_secret(tests.id('p3')) as s;
reset role;
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select login_secret from c where id = tests.id('p3')), null, '10.9.1.5') ->> 'ok', 'false', 'old invitation code dead after reset');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), (select s from newsecret), null, '10.9.1.5') ->> 'ok', 'true', 'new invitation code works');
select tests.ok(not exists (select 1 from audit.log where row_id = tests.id('p3') and (old ? 'login_secret' or new ? 'login_secret')), 'audit rows carry no invitation code');

-- B. retention: nothing purged from the audit log until approved; sign-in attempts after 30 days; erasure on delete
insert into audit.login_attempts (at, ip, ok, reason) values (now() - interval '40 days', '10.9.9.9', false, 'invalid');
insert into audit.log (at, table_name, op) values (now() - interval '400 days', 'events', 'UPDATE');
select tests.eq((app.purge_logs() ->> 'audit_log')::int, 0, 'audit log untouched before approval');
select tests.eq((select count(*) from audit.login_attempts where ip = '10.9.9.9'), 0::bigint, 'old sign-in attempts purged');
select tests.login('a1', 'aal2', 60);
select tests.throws($$select public.approve_log_retention(365)$$, 'organiser cannot approve retention', '42501');
reset role;
select tests.login('a0', 'aal2', 60);
select public.approve_log_retention(365);
select tests.ok((public.purge_logs_now() ->> 'audit_log')::int >= 1, 'approved: old audit rows purged');
reset role;
select tests.login('a1', 'aal2', 60);
delete from public.participants where id = tests.id('p7');
reset role;
select tests.ok(exists (select 1 from audit.log where row_id = tests.id('p7') and op = 'DELETE'), 'the deletion itself is logged');
select tests.ok(not exists (select 1 from audit.log where row_id = tests.id('p7') and (old ? 'last_name' or new ? 'last_name' or old ? 'phone' or new ? 'phone')), 'no name or phone of the deleted person remains in the history');

-- C. integrity
select tests.login('a1', 'aal2', 60);
select tests.throws($$insert into public.transport_legs (edition_id, kind, direction, code, capacity) values (tests.id('e1'), 'bus', 'outbound', 'A', 10)$$, 'duplicate bus code in one direction refused', '23505');
insert into public.transport_legs (edition_id, kind, direction, code, capacity) values (tests.id('e1'), 'bus', 'return', 'A', 10);
select tests.throws($$update public.transport_legs set capacity = 0 where id = tests.id('b1')$$, 'capacity cannot drop below occupancy', '23514');
select tests.throws($$update public.transport_legs set wheelchair_capacity = 0 where id = tests.id('b3')$$, 'wheelchair places cannot drop below the wheelchairs aboard', '23514');
select tests.throws($$update public.rooms set capacity = 0 where id = tests.id('r1')$$, 'room capacity cannot drop below occupancy', '23514');
update public.transport_legs set wheelchair_capacity = 1 where id = tests.id('b3');
update public.participants set mobility = 'wheelchair' where id = tests.id('p4'); -- the one place on Bus C
select tests.throws($$update public.participants set mobility = 'wheelchair' where id = tests.id('p2')$$, 'a second wheelchair user must fit the places on their legs', '23514');
reset role;

-- D. policies rewritten: the access matrix (01) still holds, and one statement evaluates membership once
select tests.ok(not exists (select 1 from pg_policies where schemaname = 'public' and (qual like '%app.is_organizer(edition_id)%' or qual like '%app.is_staff(edition_id)%' or qual like '%app.is_team(edition_id)%')), 'no per-row helper left in policies');
select tests.login('a3');
select tests.eq(tests.n('select id from public.participants'), 8::bigint, 'staff still see the edition (p7 was deleted above)');
select tests.eq(tests.n('select id from public.transport_legs'), 3::bigint, 'staff see the legs');
reset role;
select tests.login('a5');
select tests.eq(tests.n('select id from public.participants'), 1::bigint, 'pilgrim still sees only self');
reset role;

-- E. pending badges: the old badge works until the print is confirmed; a pending token scans as pending
create temp table qr (k text primary key, v text);
grant all on qr to authenticated;
select tests.login('a1', 'aal2', 60);
insert into qr values ('old', public.issue_credential(tests.id('p3')));
insert into qr values ('new', public.issue_pending_credential(tests.id('p3'), tests.id('batch1')));
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'old')) ->> 'result', 'ok', 'old badge still valid while the reprint is pending');
select tests.eq(public.scan_badge((select v from qr where k = 'new')) ->> 'result', 'pending', 'pending badge scans as pending');
select tests.eq(public.scan_badge((select v from qr where k = 'new')) #>> '{participant,last_name}', 'Poutnický', 'and names the person');
reset role;
select tests.login('a3');
select tests.throws($$select public.activate_batch(tests.id('batch1'))$$, 'staff cannot activate', '42501');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq(public.activate_batch(tests.id('batch1')), 1, 'organiser activates the batch');
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'new')) ->> 'result', 'ok', 'activated badge works');
select tests.eq(public.scan_badge((select v from qr where k = 'old')) ->> 'result', 'revoked', 'old badge revoked by the activation');
reset role;
select tests.login('a1', 'aal2', 60);
insert into qr values ('x', public.issue_pending_credential(tests.id('p4'), tests.id('batch2')));
select tests.eq(public.discard_batch(tests.id('batch2')), 1, 'a failed print is discarded');
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'x')) ->> 'result', 'not_authorized', 'discarded token is nothing');
reset role;

-- F. incidents: medical free text only for the medical role; assignee cannot reclassify
select tests.login('a3');
insert into public.incidents (edition_id, kind, summary) values (tests.id('e1'), 'operational', 'Autobus A má zpoždění 20 minut');
select tests.throws($$select summary from public.incidents$$, 'the summary column is not readable directly', '42501');
reset role;
select tests.login('a2', 'aal2', 60); -- medical
insert into public.incidents (edition_id, kind, summary) values (tests.id('e1'), 'medical', 'fiktivní zdravotní poznámka');
select tests.eq((select summary from public.incident_reports where kind = 'medical'), 'fiktivní zdravotní poznámka', 'medical role reads medical text');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq((select count(*) from public.incident_reports where kind = 'medical'), 1::bigint, 'organiser sees that a medical incident exists');
select tests.ok((select summary is null from public.incident_reports where kind = 'medical'), 'but not its text');
select tests.eq((select summary from public.incident_reports where kind = 'operational'), 'Autobus A má zpoždění 20 minut', 'operational text readable');
select tests.ok((select coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') = 'true'
                 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'incident_reports'),
  'the incident view runs with the rights of the reader, not of its owner');
select tests.ok((select app.incident_summary(id) is null from public.incidents where kind = 'medical'), 'the masking function masks for the organiser as well');
update public.incidents set assigned_to = tests.id('a3') where kind = 'operational';
reset role;
select tests.login('a3');
select tests.throws($$update public.incidents set kind = 'medical' where assigned_to = tests.id('a3')$$, 'assignee cannot reclassify', '42501');
update public.incidents set status = 'resolved', resolved_at = now() where assigned_to = tests.id('a3');
select tests.eq((select status::text from public.incident_reports where assigned_to = tests.id('a3')), 'resolved', 'assignee can resolve');
reset role;

-- anon still executes nothing
select tests.eq((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'EXECUTE')), 0::bigint, 'anon can execute no function');

rollback;
