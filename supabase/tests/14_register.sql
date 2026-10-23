-- The registration register (the organisers' sheet): running personal numbers, the register's columns readable like
-- the rest of the participant row, passport and payments for organisers only, accepting an application fills it.
begin;
select tests.eq((select count(*) from public.participants where varsym is null), 0::bigint, 'every participant has a personal number');
select tests.eq((select count(distinct varsym) from public.participants where edition_id = tests.id('e1')),
                (select count(*) from public.participants where edition_id = tests.id('e1')), 'personal numbers are unique in the edition');
insert into public.participants (id, edition_id, category, first_name, last_name) values (tests.id('r1'), tests.id('e1'), 'pilgrim', 'Nový', 'Registr');
select tests.eq((select varsym from public.participants where id = tests.id('r1')),
                (select max(varsym) from public.participants where edition_id = tests.id('e1')), 'a new person gets the next number');
select tests.throws($$insert into public.participants (edition_id, category, first_name, last_name, varsym)
  select tests.id('e1'), 'pilgrim', 'Dvojí', 'Číslo', varsym from public.participants where id = tests.id('r1')$$, 'a number is used once', '23505');
insert into public.participant_private (participant_id, edition_id, passport, paid_czk) values (tests.id('r1'), tests.id('e1'), 'X000000', 18000);
select tests.throws($$insert into public.participant_private (participant_id, edition_id) values (tests.id('p1'), tests.id('e2'))$$,
  'a payment row belongs to the participant''s own edition', '23514');

-- organiser: edits the register and reads passport and payments
select tests.login('a1', 'aal2', 60);
update public.participants set waiting = true, gender = 'F', is_nurse = true, stays = 'A' where id = tests.id('r1');
select tests.eq(tests.n($$select varsym, waiting, gender, is_nurse, stays from public.participants where id = tests.id('r1') and waiting and is_nurse$$), 1::bigint, 'organiser edits the register');
select tests.eq((select paid_czk from public.participant_private where participant_id = tests.id('r1')), 18000, 'organiser reads payments');
update public.participant_private set paid_czk = 10000 where participant_id = tests.id('r1');
reset role;
select tests.ok(exists (select 1 from audit.log where table_name = 'participant_private' and op = 'UPDATE'), 'payment changes are audited');

-- staff read the operational columns but not passport or payments; nobody else sees the private table
select tests.login('a3', 'aal2', 60);
select tests.eq(tests.n($$select varsym, stays, is_nurse from public.participants where id = tests.id('r1')$$), 1::bigint, 'staff read the register columns');
select tests.eq(tests.n($$select * from public.participant_private$$), 0::bigint, 'staff see no passport or payment');
reset role;
select tests.login('a2', 'aal2', 60);
select tests.eq(tests.n($$select * from public.participant_private$$), 0::bigint, 'medical role sees no payments');
reset role;
select tests.login('a1');
select tests.eq(tests.n($$select * from public.participant_private$$), 0::bigint, 'organiser without MFA sees nothing');
reset role;
select tests.anon();
select tests.throws($$select * from public.participant_private$$, 'anon cannot read', '42501');
reset role;

-- accepting an application fills the register
insert into public.applications (id, edition_id, form, full_name, first_name, last_name, birth_date, email, phone, times, gender, passport, travels_with, submitted_at) values
  (tests.id('x9'), tests.id('e1'), 'malade', 'Anna Webová', 'Anna', 'Webová', '1951-02-03', 'anna@example.test', '+000 9', '3', 'F', 'P1234567', 'dcera', '2099-01-13 10:00+00');
select tests.login('a1', 'aal2', 60);
select public.accept_application(tests.id('x9'), 'malade', 'Anna', 'Webová');
select tests.eq((select gender || ' ' || birth_year || ' ' || previous_count || ' ' || registered_on || ' ' || stays || ' ' || travels_with
                 from public.participants where last_name = 'Webová'), 'F 1951 3 2099-01-13 A dcera', 'type, gender, birth year, earlier pilgrimages, date, Accueil, travels with');
select tests.eq((select pp.passport from public.participant_private pp join public.participants p on p.id = pp.participant_id where p.last_name = 'Webová'),
                'P1234567', 'passport goes to the organisers-only table');
reset role;
rollback;
