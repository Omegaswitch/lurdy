-- Archive of past pilgrimages: only organisers (any edition, second factor) and super admins see or change it.
begin;

select tests.login('a1', 'aal2', 60);
insert into public.archive_people (list, year, last_name, first_name, birth_date, email) values
  ('malade', 2019, 'Vzorová', 'Marie', '1950-04-03', 'marie@example.test'),
  ('pilgrim', 2019, 'Novák', 'Petr', null, null),
  ('team', 2018, 'Dupont', 'Jean', null, null);
select tests.eq(tests.n($$select * from public.archive_people$$), 3::bigint, 'organiser imports and reads the archive');
-- (accents fold only in a UTF-8 database like Supabase's; this throwaway one is ASCII, so case is what is tested here)
select tests.throws($$insert into public.archive_people (list, year, last_name, first_name, birth_date) values ('malade', 2019, 'Vzorová', 'MARIE', '1950-04-03')$$,
  'the same person, list and year is archived once (case ignored)', '23505');
insert into public.archive_people (list, year, last_name, first_name) values ('malade', 2020, 'Vzorová', 'Marie');
select tests.eq(tests.n($$select * from public.archive_people where last_name = 'Vzorová'$$), 2::bigint, 'another year is another row');
update public.archive_people set note = 'jela s dcerou' where last_name = 'Novák';
delete from public.archive_people where last_name = 'Dupont';
select tests.eq(tests.n($$select * from public.archive_people$$), 3::bigint, 'organiser edits and deletes');
reset role;
select tests.eq(tests.n($$select * from audit.log where table_name = 'archive_people'$$), 6::bigint, 'every change is audited');

-- without the second factor the organiser has no access
select tests.login('a1');
select tests.eq(tests.n($$select * from public.archive_people$$), 0::bigint, 'organiser without MFA sees nothing');
select tests.throws($$insert into public.archive_people (list, year, last_name, first_name) values ('pilgrim', 2019, 'X', 'Y')$$, 'organiser without MFA cannot import', '42501');
reset role;

-- an organiser of another edition shares the archive (it spans years); the super admin too
select tests.login('a8', 'aal2', 60);
select tests.eq(tests.n($$select * from public.archive_people$$), 3::bigint, 'organiser of another edition reads the archive');
reset role;
select tests.login('a0', 'aal2', 60);
select tests.eq(tests.n($$select * from public.archive_people$$), 3::bigint, 'super admin reads the archive');
reset role;

-- nobody else: medical, staff, assistant, pilgrim, a user without a role, anon
select tests.login('a2', 'aal2', 60);
select tests.eq(tests.n($$select * from public.archive_people$$), 0::bigint, 'medical role sees nothing');
reset role;
select tests.login('a3', 'aal2', 60);
select tests.eq(tests.n($$select * from public.archive_people$$), 0::bigint, 'staff sees nothing');
select tests.throws($$insert into public.archive_people (list, year, last_name, first_name) values ('pilgrim', 2019, 'X', 'Y')$$, 'staff cannot import', '42501');
update public.archive_people set note = 'x';
delete from public.archive_people;
reset role;
select tests.eq(tests.n($$select * from public.archive_people where note = 'x'$$), 0::bigint, 'staff changed nothing');
select tests.eq(tests.n($$select * from public.archive_people$$), 3::bigint, 'staff deleted nothing');
select tests.login('a5');
select tests.eq(tests.n($$select * from public.archive_people$$), 0::bigint, 'pilgrim sees nothing');
reset role;
select tests.login('a7', 'aal2', 60);
select tests.eq(tests.n($$select * from public.archive_people$$), 0::bigint, 'user without a role sees nothing');
reset role;
select tests.anon();
select tests.throws($$select * from public.archive_people$$, 'anon cannot read the archive', '42501');
reset role;

-- no column for health data
select tests.eq((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'archive_people'
                 and column_name ~ '(diagn|medic|health|allerg|drug|lek)'), 0::bigint, 'the archive has no health column');

rollback;
