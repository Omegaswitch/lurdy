-- Who sees what: the matrix in docs/F-security-privacy.md §3.
begin;

-- anonymous: nothing
select tests.anon();
select tests.throws('select * from public.participants', 'anon cannot read participants', '42501');
select tests.throws('select * from public.editions', 'anon cannot read editions', '42501');
select tests.throws('select public.my_pilgrimage()', 'anon cannot call RPCs', '42501');
reset role;

-- outsider with an account but no participation or role
select tests.login('a7');
select tests.eq(tests.n('select * from public.participants'), 0::bigint, 'outsider sees no participants');
select tests.eq(tests.n('select * from public.editions'), 0::bigint, 'outsider sees no editions');
select tests.eq(tests.n('select * from public.events'), 0::bigint, 'outsider sees no events');
select tests.eq(tests.n('select * from public.places where edition_id is not null'), 0::bigint, 'outsider sees no edition places');
select tests.ok(tests.n('select * from public.places where edition_id is null') > 0, 'shared sanctuary places are visible to any active account');
select tests.ok(public.my_pilgrimage() is null, 'outsider has no pilgrimage');
reset role;

-- pilgrim: own data only
select tests.login('a5');
select tests.eq(tests.n('select * from public.participants'), 1::bigint, 'pilgrim sees only self');
select tests.eq(tests.n('select * from public.leg_assignments'), 1::bigint, 'pilgrim sees own leg assignment');
select tests.eq(tests.n('select * from public.transport_legs'), 1::bigint, 'pilgrim sees own leg only');
select tests.eq(tests.n('select * from public.room_assignments'), 1::bigint, 'pilgrim sees own room assignment, no roommates');
select tests.eq(tests.n('select * from public.rooms'), 1::bigint, 'pilgrim sees own room only');
select tests.eq(tests.n('select * from public.facilities'), 2::bigint, 'pilgrim sees facilities of the edition');
select tests.eq(tests.n('select * from public.care_assignments'), 0::bigint, 'pilgrim sees no care assignments');
select tests.eq(tests.n('select * from public.emergency_contacts'), 0::bigint, 'pilgrim sees no one else''s emergency contacts');
select tests.eq(tests.n('select * from public.events'), 2::bigint, 'pilgrim sees events for all + pilgrims, not team-only');
select tests.eq(tests.n('select * from public.contacts'), 1::bigint, 'pilgrim sees public contacts only');
select tests.eq(tests.n('select * from public.announcements'), 1::bigint, 'pilgrim sees published announcements only');
select tests.eq(tests.n('select * from public.teams'), 0::bigint, 'pilgrim sees no teams');
select tests.eq(tests.n('select * from public.credentials'), 0::bigint, 'pilgrim sees no credentials');
select tests.eq(tests.n('select * from public.scans'), 0::bigint, 'pilgrim sees no scans');
select tests.eq(tests.n('select * from public.editions'), 1::bigint, 'pilgrim sees own edition only');
-- writes refused
update public.participants set first_name = 'X' where id = tests.id('p3');
select tests.throws($$insert into public.participants (edition_id, category, first_name, last_name) values (tests.id('e1'), 'pilgrim', 'A', 'B')$$, 'pilgrim cannot create participants', '42501');
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b3'), tests.id('p3'))$$, 'pilgrim cannot assign buses', '42501');
select tests.throws($$update public.profiles set is_super_admin = true where id = tests.id('a5')$$, 'pilgrim cannot make self super admin', '42501');
reset role;
select tests.eq((select first_name from public.participants where id = tests.id('p3')), 'Petr', 'pilgrim update was silently filtered by RLS');

-- malade: own data + names of carers via my_pilgrimage
select tests.login('a6');
select tests.eq(tests.n('select * from public.participants'), 1::bigint, 'malade sees only self in the table');
select tests.eq(tests.n('select * from public.care_assignments'), 1::bigint, 'malade sees own care assignment');
select tests.eq(jsonb_array_length(public.my_pilgrimage() -> 'carers'), 1, 'my_pilgrimage lists the carer');
select tests.eq(tests.n('select * from public.emergency_contacts'), 1::bigint, 'malade sees own emergency contact');
reset role;

-- assistant (carer of p4): own data + the malade in care, but not other participants
select tests.login('a4');
select tests.eq(tests.n('select * from public.participants'), 2::bigint, 'assistant sees self + malade in care');
select tests.ok(exists (select 1 from public.participants where id = tests.id('p4')), 'assistant sees the malade in care');
select tests.ok(not exists (select 1 from public.participants where id = tests.id('p5')), 'assistant does not see other malades');
select tests.ok(public.participant_card(tests.id('p4')) is not null, 'assistant gets the card of the malade in care');
select tests.ok(public.participant_card(tests.id('p5')) is null, 'assistant gets no card for others');
select tests.eq(tests.n('select * from public.events'), 3::bigint, 'team sees all events');
select tests.eq(public.scan_badge('LRD1.' || repeat('0', 32)) ->> 'result', 'not_authorized', 'assistant cannot scan');
select tests.eq(jsonb_array_length(public.my_pilgrimage() -> 'in_care'), 1, 'my_pilgrimage lists the person in care');
reset role;

-- staff: all participants of own edition, nothing of the other edition, no writes
select tests.login('a3');
select tests.eq(tests.n('select * from public.participants'), 9::bigint, 'staff sees all participants of E1');
select tests.ok(not exists (select 1 from public.participants where id = tests.id('p9')), 'staff does not see E2');
select tests.eq(tests.n('select * from public.emergency_contacts'), 1::bigint, 'staff sees emergency contacts');
select tests.throws($$insert into public.leg_assignments (leg_id, participant_id) values (tests.id('b3'), tests.id('p7'))$$, 'staff cannot assign', '42501');
select tests.throws($$insert into public.role_grants (participant_id, role) values (tests.id('p7'), 'staff')$$, 'staff cannot grant roles', '42501');
select tests.eq(tests.n('select * from public.staff_codes'), 0::bigint, 'staff cannot read event codes');
reset role;

-- organiser: requires MFA (aal2)
select tests.login('a1', 'aal1');
select tests.eq(tests.n('select * from public.participants'), 1::bigint, 'organiser without MFA sees only own record');
select tests.throws($$insert into public.participants (edition_id, category, first_name, last_name) values (tests.id('e1'), 'pilgrim', 'A', 'B')$$, 'organiser without MFA cannot write', '42501');
reset role;
select tests.login('a1', 'aal2', 60);
select tests.eq(tests.n('select * from public.participants'), 9::bigint, 'organiser with MFA sees E1');
insert into public.participants (edition_id, category, first_name, last_name) values (tests.id('e1'), 'pilgrim', 'Nový', 'Účastník');
select tests.eq(tests.n('select * from public.participants'), 10::bigint, 'organiser can create a participant');
select tests.throws($$insert into public.participants (edition_id, category, first_name, last_name) values (tests.id('e2'), 'pilgrim', 'A', 'B')$$, 'organiser cannot write another edition', '42501');
insert into public.role_grants (participant_id, role) values (tests.id('p7'), 'staff');
select tests.throws($$insert into public.role_grants (participant_id, role) values (tests.id('p7'), 'medical')$$, 'organiser cannot grant medical', '42501');
select tests.throws($$insert into public.role_grants (participant_id, role) values (tests.id('p7'), 'organizer')$$, 'organiser cannot grant organizer', '42501');
select tests.throws($$insert into public.role_grants (participant_id, role) values (tests.id('p9'), 'staff')$$, 'organiser cannot grant in another edition', '42501');
select tests.throws($$insert into public.editions (year, title, starts_on, ends_on) values (2101, 'X', '2101-01-01', '2101-01-02')$$, 'organiser cannot create editions', '42501');
select tests.eq(tests.n('select * from public.announcements'), 2::bigint, 'organiser sees unpublished announcements');
reset role;

-- super admin: needs MFA; everything except medical
select tests.login('a0', 'aal1');
select tests.eq(tests.n('select * from public.editions'), 0::bigint, 'super admin without MFA sees nothing');
reset role;
select tests.login('a0', 'aal2', 60);
select tests.eq(tests.n('select * from public.editions'), 2::bigint, 'super admin sees all editions');
select tests.ok(app.is_staff(tests.id('e2')), 'super admin counts as staff');
select tests.ok(not app.is_medical(tests.id('e1')), 'super admin is not medical');
insert into public.editions (year, title, starts_on, ends_on) values (2101, 'Třetí', '2101-01-01', '2101-01-02');
reset role;

-- suspension takes effect immediately
update public.profiles set status = 'suspended' where id = tests.id('a3');
select tests.login('a3');
select tests.eq(tests.n('select * from public.participants'), 0::bigint, 'suspended staff sees nothing');
select tests.eq(public.scan_badge('LRD1.' || repeat('0', 32)) ->> 'result', 'not_authorized', 'suspended staff cannot scan');
reset role;
update public.profiles set status = 'suspended' where id = tests.id('a5');
select tests.login('a5');
select tests.eq(tests.n('select * from public.participants'), 0::bigint, 'suspended participant sees nothing');
select tests.ok(public.my_pilgrimage() is null, 'suspended participant gets no pilgrimage');
reset role;

-- schema hygiene: every public table has RLS; medical/audit/app not usable by API roles
select tests.eq((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'RLS on every public table');
select tests.ok(not has_schema_privilege('authenticated', 'audit', 'usage'), 'audit schema not usable');
select tests.ok(not has_schema_privilege('authenticated', 'medical', 'usage'), 'medical schema not usable');
select tests.ok(not has_schema_privilege('anon', 'app', 'usage'), 'app schema not usable by anon');
select tests.eq((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'app') and p.prosecdef
                   and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')), 0::bigint,
                'every security definer function pins search_path');

rollback;
