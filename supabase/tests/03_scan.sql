-- QR credentials and scanning, including the core scenario:
-- badge printed while on Bus A → moved to Bus C → scanning the same badge shows Bus C.
begin;
create temp table qr (k text primary key, v text);
grant all on qr to authenticated;

-- only organisers issue credentials
select tests.login('a3');
select tests.throws($$select public.issue_credential(tests.id('p3'))$$, 'staff cannot issue credentials', '42501');
select tests.throws($$insert into public.credentials (edition_id, participant_id, token_hash) values (tests.id('e1'), tests.id('p3'), '\x00')$$, 'no direct insert', '42501');
reset role;

select tests.login('a1', 'aal2', 60);
insert into qr values ('p3', public.issue_credential(tests.id('p3')));
select tests.ok((select v ~ '^LRD1\.[0-9A-F]{32}$' from qr where k = 'p3'), 'QR payload format');
select tests.ok(not exists (select 1 from public.credentials where token_hash = convert_to((select v from qr where k = 'p3'), 'UTF8')), 'token is not stored in clear');
reset role;

-- staff scan: lookup returns live record with Bus A
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) ->> 'result', 'ok', 'staff lookup ok');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) #>> '{participant,legs,0,code}', 'A', 'scan shows Bus A');
select tests.ok(public.scan_badge((select v from qr where k = 'p3')) -> 'participant' -> 'room' ->> 'number' = '101', 'scan shows room');
select tests.ok(not (public.scan_badge((select v from qr where k = 'p3')) -> 'participant' ? 'medical'), 'scan carries no medical key');
reset role;

-- organiser moves p3 from Bus A to Bus C; the printed badge is unchanged
select tests.login('a1', 'aal2', 60);
update public.leg_assignments set leg_id = tests.id('b3') where participant_id = tests.id('p3') and leg_id = tests.id('b1');
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) #>> '{participant,legs,0,code}', 'C', 'same badge now shows Bus C');
-- boarding: wrong bus, then right bus; idempotent replay
select tests.eq(public.scan_badge((select v from qr where k = 'p3'), 'board', tests.id('b1')) ->> 'result', 'wrong_leg', 'boarding the old bus is flagged');
select tests.eq(public.scan_badge((select v from qr where k = 'p3'), 'board', tests.id('b3'), tests.id('s1')) ->> 'result', 'ok', 'boarding Bus C ok');
select tests.ok((select boarded_at is not null and boarded_by = tests.id('a3') from public.leg_assignments where participant_id = tests.id('p3')), 'boarding recorded with who');
select tests.eq(public.scan_badge((select v from qr where k = 'p3'), 'board', tests.id('b3'), tests.id('s1')) ->> 'replayed', 'true', 'replayed scan id is not recorded twice');
select tests.eq(tests.n($$select * from public.scans where client_scan_id = tests.id('s1')$$), 1::bigint, 'one scan row per client id');
select tests.eq(public.scan_badge((select v from qr where k = 'p3'), 'board', tests.id('b9')) ->> 'result', 'wrong_leg', 'leg of another edition refused');
select tests.eq(public.scan_badge((select v from qr where k = 'p3'), 'check_in') ->> 'result', 'ok', 'room check-in');
-- invalid payloads
select tests.eq(public.scan_badge('https://evil.example/x') ->> 'result', 'invalid', 'foreign QR is invalid');
select tests.eq(public.scan_badge('LRD1.' || repeat('A', 32)) ->> 'result', 'not_authorized', 'unknown token reveals nothing');
-- manual fallback
select tests.eq(public.staff_action(tests.id('p4'), 'arrive', tests.id('b3')) ->> 'result', 'ok', 'manual arrive');
select tests.ok((select arrived_at is not null and boarded_at is not null from public.leg_assignments where participant_id = tests.id('p4')), 'arrive implies boarded');
reset role;

-- other edition's organiser and non-staff learn nothing
select tests.login('a8', 'aal2', 60);
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) ->> 'result', 'not_authorized', 'E2 organiser cannot scan E1 badge');
select tests.ok(public.scan_badge((select v from qr where k = 'p3')) -> 'participant' is null, 'no data for unauthorised scanner');
reset role;
select tests.login('a5');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) ->> 'result', 'not_authorized', 'pilgrim cannot scan');
select tests.ok(public.participant_card(tests.id('p4')) is null, 'pilgrim gets no participant card');
select tests.throws($$select app.participant_card(tests.id('p4'))$$, 'internal card function not callable', '42501');
-- participant app reflects the move
select tests.eq(public.my_pilgrimage() #>> '{legs,0,code}', 'C', 'participant app shows Bus C');
select tests.ok(public.my_pilgrimage() #>> '{legs,0,boarded_at}' is not null, 'participant app shows boarded');
select tests.eq(jsonb_array_length(public.my_pilgrimage() -> 'events'), 2, 'participant programme filtered by category');
select tests.ok(jsonb_array_length(public.my_pilgrimage() -> 'places') >= 14, 'participant gets the map places');
-- digital credential: own QR, replaced on each request
insert into qr values ('d1', public.my_digital_credential());
insert into qr values ('d2', public.my_digital_credential());
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'd1')) ->> 'result', 'revoked', 'old digital QR is revoked');
select tests.eq(public.scan_badge((select v from qr where k = 'd2')) ->> 'result', 'ok', 'new digital QR works');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) ->> 'result', 'ok', 'card still valid alongside digital');
reset role;

-- a suspended scanner cannot replay an earlier scan id to read data
update public.profiles set status = 'suspended' where id = tests.id('a3');
select tests.login('a3');
select tests.eq(public.scan_badge('x', 'board', null, tests.id('s1')) ->> 'result', 'not_authorized', 'replay checks the scanner is still staff');
reset role;
update public.profiles set status = 'active' where id = tests.id('a3');

-- lost badge: revoke and reissue
select tests.login('a1', 'aal2', 60);
select public.revoke_credential(tests.id('p3'), 'ztraceno');
insert into qr values ('p3new', public.issue_credential(tests.id('p3')));
reset role;
select tests.login('a3');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) ->> 'result', 'revoked', 'lost badge scans as revoked');
select tests.eq(public.scan_badge((select v from qr where k = 'p3')) #>> '{participant,last_name}', 'Poutnický', 'revoked scan still identifies whose badge it was (staff)');
select tests.eq(public.scan_badge((select v from qr where k = 'p3new')) ->> 'result', 'ok', 'replacement badge works');
reset role;
select tests.eq(tests.n($$select * from public.credentials where participant_id = tests.id('p3') and kind = 'card' and revoked_at is null$$), 1::bigint, 'exactly one active card');

rollback;
