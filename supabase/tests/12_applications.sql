-- Applications from the website: only the organisers of that edition see, accept or decline them; nobody inserts
-- through the API (the intake function uses the service role); accepting creates the participant in one step.
begin;
-- as the intake function does (service role): two for E1, one for E2
insert into public.applications (id, edition_id, form, full_name, first_name, last_name, birth_date, email, phone, emergency_name, emergency_phone, language) values
  (tests.id('x1'), tests.id('e1'), 'malade', 'Marie Přihlášená', 'Marie', 'Přihlášená', '1950-04-03', 'marie@example.test', '+000 11', 'Eva', '+000 12', 'cs'),
  (tests.id('x2'), tests.id('e1'), 'team', 'Jan Dobrovolný', 'Jan', 'Dobrovolný', null, 'jan@example.test', '+000 21', null, null, 'en'),
  (tests.id('x3'), tests.id('e2'), 'pilgrim', 'Ota Jinýročník', 'Ota', 'Jinýročník', null, null, null, null, null, 'cs');

select tests.login('a1', 'aal2', 60);
select tests.eq(tests.n($$select * from public.applications$$), 2::bigint, 'organiser sees the applications of their edition only');
select tests.throws($$insert into public.applications (edition_id, form, full_name, first_name, last_name) values (tests.id('e1'), 'pilgrim', 'X Y', 'X', 'Y')$$,
  'nobody inserts through the API, not even an organiser', '42501');
select tests.ok(public.accept_application(tests.id('x1'), 'malade', 'Marie', 'Přihlášená-Nová') is not null, 'organiser accepts');
select tests.eq((select category::text || ' ' || last_name || ' ' || email || ' ' || phone || ' ' || language from public.participants
                 where id = (select participant_id from public.applications where id = tests.id('x1'))),
  'malade Přihlášená-Nová marie@example.test +000 11 cs', 'the participant is created from the application, with the corrected name');
select tests.eq((select status::text from public.applications where id = tests.id('x1')), 'accepted', 'and the application is marked accepted');
select tests.throws($$select public.accept_application(tests.id('x1'), 'malade', 'Marie', 'Přihlášená')$$, 'an application is accepted once', '55000');
select tests.throws($$select public.accept_application(tests.id('x3'), 'pilgrim', 'Ota', 'Jinýročník')$$, 'not an application of another edition', '42501');
update public.applications set status = 'declined', decided_at = now() where id = tests.id('x2');
select tests.eq((select status::text from public.applications where id = tests.id('x2')), 'declined', 'organiser declines');
reset role;
select tests.ok((select access_code is not null from public.participants where last_name = 'Přihlášená-Nová'), 'the new participant gets sign-in codes');
select tests.ok(exists (select 1 from audit.log where table_name = 'applications' and op = 'UPDATE'), 'decisions are audited');

-- the same organiser through the code sign-in, or without the second factor: nothing
select tests.login('a1');
select tests.eq(tests.n($$select * from public.applications$$), 0::bigint, 'organiser without MFA sees nothing');
reset role;
-- nobody else: medical, staff, pilgrim, a user without a role, anon
select tests.login('a2', 'aal2', 60);
select tests.eq(tests.n($$select * from public.applications$$), 0::bigint, 'medical role sees nothing');
reset role;
select tests.login('a3', 'aal2', 60);
select tests.eq(tests.n($$select * from public.applications$$), 0::bigint, 'staff sees nothing');
update public.applications set status = 'new';
reset role;
select tests.eq((select status::text from public.applications where id = tests.id('x2')), 'declined', 'staff changed nothing');
select tests.login('a5');
select tests.eq(tests.n($$select * from public.applications$$), 0::bigint, 'pilgrim sees nothing');
select tests.throws($$select public.accept_application(tests.id('x3'), 'pilgrim', 'Ota', 'Jinýročník')$$, 'pilgrim cannot accept', '42501');
reset role;
select tests.login('a7', 'aal2', 60);
select tests.eq(tests.n($$select * from public.applications$$), 0::bigint, 'user without a role sees nothing');
reset role;
select tests.anon();
select tests.throws($$select * from public.applications$$, 'anon cannot read applications', '42501');
select tests.throws($$select public.accept_application(tests.id('x3'), 'pilgrim', 'Ota', 'Jinýročník')$$, 'anon cannot accept', '42501');
reset role;

-- no column for health data (the ID-card / passport number is kept: the flight manifest needs it, organisers only)
select tests.eq((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'applications'
                 and column_name ~ '(diagn|medic|health|allerg|drug|lek|doctor)'), 0::bigint, 'applications have no health column');
rollback;
