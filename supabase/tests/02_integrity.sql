-- Integrity rules: capacity, wheelchair places, edition consistency, care roles, versioning, audit.
begin;
select tests.login('a1', 'aal2', 60);

-- Bus A: capacity 3, 1 wheelchair place; holds p3.
insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b1'), tests.id('p6')); -- wheelchair 1/1
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b1'), tests.id('p4'))$$,
  'second wheelchair user refused on bus with one wheelchair place', '23514');
insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b1'), tests.id('p7')); -- 3/3
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b1'), tests.id('p5'))$$,
  'full bus refuses another passenger', '23514');
select tests.throws($$update public.leg_assignments set leg_id = tests.id('b1') where participant_id = tests.id('p2')$$,
  'moving onto a full bus is refused', '23514');
rollback;

begin;
select tests.login('a1', 'aal2', 60);
-- a participant may be on different legs (outbound bus A, return bus C)
insert into public.transport_legs (id, edition_id, kind, direction, code, capacity) values (tests.id('b5'), tests.id('e1'), 'bus', 'return', 'C-návrat', 40);
insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b5'), tests.id('p3'));
select tests.eq(tests.n($$select * from public.leg_assignments where participant_id = tests.id('p3')$$), 2::bigint, 'different legs per direction');
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b5'), tests.id('p3'))$$, 'same leg twice refused', '23505');

-- rooms: capacity 2, room 201 holds p4 + p2
select tests.throws($$insert into public.room_assignments (room_id, participant_id) values (tests.id('r2'), tests.id('p5'))$$, 'full room refused', '23514');
select tests.throws($$insert into public.room_assignments (room_id, participant_id) values (tests.id('r1'), tests.id('p4'))$$, 'one room per participant', '23505');
update public.room_assignments set room_id = tests.id('r1') where participant_id = tests.id('p2');
select tests.eq((select room_id from public.room_assignments where participant_id = tests.id('p2')), tests.id('r1'), 'move to a room with space');
reset role;

-- edition consistency (as superuser, so policies are not what stops it)
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b9'), tests.id('p3'))$$, 'cannot put E1 participant on E2 bus', '23514');
select tests.throws($$insert into public.care_assignments (malade_id, carer_id) values (tests.id('p4'), tests.id('p9'))$$, 'carer from another edition refused', '23514');
select tests.throws($$update public.transport_legs set facility_id = tests.id('f1') where id = tests.id('b9')$$, 'leg facility from another edition refused', '23514');
select tests.throws($$update public.participants set edition_id = tests.id('e2') where id = tests.id('p3')$$, 'edition_id cannot change', '23514');

-- care roles
select tests.throws($$insert into public.care_assignments (malade_id, carer_id) values (tests.id('p3'), tests.id('p2'))$$, 'only malades can be cared for', '23514');
select tests.throws($$insert into public.care_assignments (malade_id, carer_id) values (tests.id('p4'), tests.id('p5'))$$, 'a malade cannot be a carer', '23514');
select tests.throws($$insert into public.care_assignments (malade_id, carer_id) values (tests.id('p4'), tests.id('p2'))$$, 'duplicate primary carer refused', '23505');
select tests.throws($$insert into public.care_assignments (malade_id, carer_id, kind) values (tests.id('p5'), tests.id('p1'), 'temporary')$$, 'temporary cover needs a period', '23514');
insert into public.care_assignments (malade_id, carer_id, kind, starts_at, ends_at)
  values (tests.id('p4'), tests.id('p1'), 'temporary', now() - interval '1 hour', now() + interval '1 hour');
select tests.login('a3');
select tests.ok(app.is_carer_of(tests.id('p4')), 'temporary cover is active now');
reset role;

-- versioning: optimistic lock, version bumps, client cannot fake it
select tests.login('a1', 'aal2', 60);
select tests.eq((select version from public.participants where id = tests.id('p7')), 1, 'starts at version 1');
update public.participants set phone = '+000 7', version = 99 where id = tests.id('p7') and version = 1;
select tests.eq((select version from public.participants where id = tests.id('p7')), 2, 'version bumps by one regardless of payload');
update public.participants set phone = '+000 77' where id = tests.id('p7') and version = 1;
select tests.eq((select phone from public.participants where id = tests.id('p7')), '+000 7', 'stale version updates nothing');
reset role;

-- audit: who changed what
select tests.ok(exists (select 1 from audit.log where table_name = 'participants' and row_id = tests.id('p7') and op = 'UPDATE'
                        and actor = tests.id('a1') and old ->> 'phone' is null and new ->> 'phone' = '+000 7'), 'update is audited with actor and before/after');
select tests.ok(exists (select 1 from audit.log where table_name = 'room_assignments' and op = 'UPDATE'), 'room move audited');

rollback;
