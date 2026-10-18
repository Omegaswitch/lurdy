-- Test helpers and an entirely fictional fixture. Ids are fixed so tests can refer to them.
create schema tests;
grant usage on schema tests to authenticated, anon;

-- tests.id('a1') → a stable uuid for fixture key 'a1'
create function tests.id(k text) returns uuid language sql immutable as $$
  select md5('fixture:' || k)::uuid $$;

-- Act as a signed-in user. aal2 + mfa_ago (seconds since TOTP) simulate MFA.
create function tests.login(k text, aal text default 'aal1', mfa_ago int default null) returns void language plpgsql as $$
declare now_s bigint := extract(epoch from now())::bigint;
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', tests.id(k), 'role', 'authenticated', 'aal', aal,
    'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', now_s - 3600))
           || case when mfa_ago is null then '[]'::jsonb
                   else jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', now_s - mfa_ago)) end)::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'FAIL: %', msg;
  end if;
end $$;

create function tests.eq(got anyelement, want anyelement, msg text) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL: % (got %, want %)', msg, got, want;
  end if;
end $$;

-- Runs sql; passes if it raises (optionally with the given SQLSTATE).
create function tests.throws(sql text, msg text, state text default null) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if state is not null and sqlstate <> state then
      raise exception 'FAIL: % (raised % %, want %)', msg, sqlstate, sqlerrm, state;
    end if;
    return;
  end;
  raise exception 'FAIL: % (no error raised)', msg;
end $$;

create function tests.n(sql text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute format('select count(*) from (%s) q', sql) into c;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------- fixture
-- Users: a0 super admin, a1 organiser E1, a2 medical E1, a3 staff E1, a4 assistant E1,
--        a5 pilgrim E1, a6 malade E1, a7 nobody, a8 organiser E2.
insert into auth.users (id, email)
select tests.id(k), k || '@example.test' from unnest(array['a0','a1','a2','a3','a4','a5','a6','a7','a8']) k;
update public.profiles set is_super_admin = true where id = tests.id('a0');

insert into public.editions (id, year, title, starts_on, ends_on, status, emergency_phone) values
  (tests.id('e1'), 2099, 'Zkušební pouť', '2099-05-01', '2099-05-05', 'active', '+000 000 000'),
  (tests.id('e2'), 2100, 'Druhá zkušební pouť', '2100-05-01', '2100-05-05', 'draft', null);

-- Participants: p1 staff(a3), p2 assistant(a4), p3 pilgrim(a5), p4 malade(a6), p5 malade (no account),
--               p6 pilgrim (no account, wheelchair), p7 pilgrim (no account), q1 organiser(a1), q2 medical(a2);
--               E2: p9 pilgrim, q8 organiser(a8).
insert into public.participants (id, edition_id, user_id, category, first_name, last_name, mobility, phone) values
  (tests.id('p1'), tests.id('e1'), tests.id('a3'), 'staff', 'Tomáš', 'Zkoušecí', 'walks', '+000 1'),
  (tests.id('p2'), tests.id('e1'), tests.id('a4'), 'assistant', 'Alena', 'Pomocná', 'walks', '+000 2'),
  (tests.id('p3'), tests.id('e1'), tests.id('a5'), 'pilgrim', 'Petr', 'Poutnický', 'walks', '+000 3'),
  (tests.id('p4'), tests.id('e1'), tests.id('a6'), 'malade', 'Marie', 'Vzorová', 'wheelchair', '+000 4'),
  (tests.id('p5'), tests.id('e1'), null, 'malade', 'Jan', 'Fiktivní', 'assisted', null),
  (tests.id('p6'), tests.id('e1'), null, 'pilgrim', 'Eva', 'Smyšlená', 'wheelchair', null),
  (tests.id('p7'), tests.id('e1'), null, 'pilgrim', 'Karel', 'Ukázkový', 'walks', null),
  (tests.id('p9'), tests.id('e2'), null, 'pilgrim', 'Olga', 'Jinoročná', 'walks', null),
  (tests.id('q1'), tests.id('e1'), tests.id('a1'), 'staff', 'Ota', 'Organizační', 'walks', null),
  (tests.id('q2'), tests.id('e1'), tests.id('a2'), 'staff', 'Lída', 'Lékařská', 'walks', null),
  (tests.id('q8'), tests.id('e2'), tests.id('a8'), 'staff', 'Olaf', 'Druhoročný', 'walks', null);

-- Roles belong to participants; team members also need a valid event code on their profile.
insert into public.role_grants (participant_id, role) values
  (tests.id('q1'), 'organizer'), (tests.id('q2'), 'medical'), (tests.id('p1'), 'staff'),
  (tests.id('p2'), 'assistant'), (tests.id('q8'), 'organizer');
insert into public.staff_codes (id, edition_id, code, label, valid_from, valid_until) values
  (tests.id('c1'), tests.id('e1'), 'ABC123', 'během pouti', now() - interval '1 day', now() + interval '10 days'),
  (tests.id('c0'), tests.id('e1'), 'OLD000', 'před poutí', now() - interval '30 days', now() - interval '1 day'),
  (tests.id('c2'), tests.id('e2'), 'XYZ789', 'před poutí', now() - interval '1 day', now() + interval '10 days');
update public.profiles set staff_code_id = tests.id('c1') where id in (tests.id('a1'), tests.id('a2'), tests.id('a3'), tests.id('a4'));
update public.profiles set staff_code_id = tests.id('c2') where id = tests.id('a8');

insert into public.emergency_contacts (participant_id, name, relation, phone) values
  (tests.id('p4'), 'Dcera Vzorová', 'dcera', '+000 99');

insert into public.facilities (id, edition_id, name, short_label, kind, colour) values
  (tests.id('f1'), tests.id('e1'), 'Hotel Ukázka', 'HOTEL', 'hotel', '#1f5fa8'),
  (tests.id('f2'), tests.id('e1'), 'Accueil Ukázka', 'ACCUEIL', 'care', '#e31818');
insert into public.rooms (id, facility_id, number, capacity) values
  (tests.id('r1'), tests.id('f1'), '101', 2), (tests.id('r2'), tests.id('f2'), '201', 2);
insert into public.room_assignments (room_id, participant_id) values
  (tests.id('r1'), tests.id('p3')), (tests.id('r2'), tests.id('p4')), (tests.id('r2'), tests.id('p2'));

insert into public.transport_legs (id, edition_id, kind, direction, code, capacity, wheelchair_capacity, facility_id) values
  (tests.id('b1'), tests.id('e1'), 'bus', 'outbound', 'A', 3, 1, tests.id('f1')),
  (tests.id('b3'), tests.id('e1'), 'bus', 'outbound', 'C', 40, 2, tests.id('f2')),
  (tests.id('b9'), tests.id('e2'), 'bus', 'outbound', 'A', 40, 2, null);
insert into public.leg_assignments (leg_id, participant_id) values
  (tests.id('b1'), tests.id('p3')), (tests.id('b3'), tests.id('p4')), (tests.id('b3'), tests.id('p2'));

insert into public.care_assignments (malade_id, carer_id, kind) values (tests.id('p4'), tests.id('p2'), 'primary');

insert into public.events (edition_id, starts_at, title, audiences) values
  (tests.id('e1'), '2099-05-01 17:00+02', 'Mše pro všechny', '{}'),
  (tests.id('e1'), '2099-05-02 05:00+02', 'Budíček týmu', '{staff,assistant}'),
  (tests.id('e1'), '2099-05-02 07:00+02', 'Snídaně poutníků', '{pilgrim}');
insert into public.contacts (edition_id, label, name, phone, is_emergency, audiences) values
  (tests.id('e1'), 'Vedoucí pouti', 'Vedoucí Zkušební', '+000 10', true, '{}'),
  (tests.id('e1'), 'Koordinace týmu', 'Koordinátor Zkušební', '+000 11', false, '{staff,assistant}');
insert into public.announcements (edition_id, title, critical, published_at, audiences) values
  (tests.id('e1'), 'Změna odjezdu', true, now() - interval '1 hour', '{}'),
  (tests.id('e1'), 'Koncept', false, null, '{}');
