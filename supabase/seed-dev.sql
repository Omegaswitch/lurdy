-- Fictional development data for the development project only. Never run on production.
-- Idempotent: re-running does nothing once the dev edition exists.
do $$
declare ed uuid; hotel uuid; accueil uuid; r1 uuid; r2 uuid; bus_a uuid; bus_c uuid; flight uuid;
  p_org uuid; p_staff uuid; p_assist uuid; p_pil uuid; p_mal uuid;
begin
  if exists (select 1 from public.editions where title = 'Vývojový ročník (fiktivní data)') then
    return;
  end if;
  insert into public.editions (year, title, starts_on, ends_on, status, emergency_phone)
  values (2099, 'Vývojový ročník (fiktivní data)', '2099-04-30', '2099-05-04', 'active', '+420 000 000 000')
  returning id into ed;

  insert into public.facilities (edition_id, name, short_label, kind, address, colour, lat, lng)
  values (ed, 'Hotel Vzor', 'HOTEL', 'hotel', 'Rue Fictive 1, Lourdes', '#1f5fa8', 43.0950, -0.0470) returning id into hotel;
  insert into public.facilities (edition_id, name, short_label, kind, address, colour, lat, lng)
  values (ed, 'Accueil Vzor', 'ACCUEIL', 'care', 'Avenue Fictive 2, Lourdes', '#e31818', 43.0975, -0.0590) returning id into accueil;
  insert into public.rooms (facility_id, number, floor, capacity) values (hotel, '101', '1', 2) returning id into r1;
  insert into public.rooms (facility_id, number, floor, zone, capacity) values (accueil, '201', '2', 'A1', 4) returning id into r2;

  insert into public.participants (edition_id, category, title, first_name, last_name, phone) values
    (ed, 'staff', null, 'Olga', 'Organizační', '+420 000 000 001') returning id into p_org;
  insert into public.participants (edition_id, category, first_name, last_name, phone) values
    (ed, 'staff', 'Tomáš', 'Týmový', '+420 000 000 002') returning id into p_staff;
  insert into public.participants (edition_id, category, first_name, last_name, phone) values
    (ed, 'assistant', 'Alena', 'Asistentní', '+420 000 000 003') returning id into p_assist;
  insert into public.participants (edition_id, category, first_name, last_name) values
    (ed, 'pilgrim', 'Petr', 'Poutnický') returning id into p_pil;
  insert into public.participants (edition_id, category, first_name, last_name, mobility) values
    (ed, 'malade', 'Marie', 'Vzorová', 'wheelchair') returning id into p_mal;

  insert into public.role_grants (participant_id, role) values (p_org, 'organizer'), (p_staff, 'staff'), (p_assist, 'assistant');
  -- a second organiser used only by the automated end-to-end tests (they enrol and remove MFA on it)
  insert into public.participants (edition_id, category, first_name, last_name) values (ed, 'staff', 'Ota', 'Testovací-organizátor') returning id into p_org;
  insert into public.role_grants (participant_id, role) values (p_org, 'organizer');
  insert into public.staff_codes (edition_id, code, label, valid_from, valid_until)
  values (ed, 'DEV123', 'vývoj', now() - interval '1 day', now() + interval '365 days');

  insert into public.transport_legs (edition_id, kind, direction, code, label, origin, destination, departs_at, arrives_at, capacity, wheelchair_capacity)
  values (ed, 'flight', 'outbound', 'XX0001', 'Charter', 'Praha', 'Tarbes-Lourdes', '2099-04-30 08:00+02', '2099-04-30 10:00+02', 180, 10) returning id into flight;
  insert into public.transport_legs (edition_id, kind, direction, code, label, origin, destination, capacity, wheelchair_capacity, facility_id)
  values (ed, 'bus', 'outbound', 'A', 'Bus A – hotel', 'Letiště', 'Hotel Vzor', 50, 1, hotel) returning id into bus_a;
  insert into public.transport_legs (edition_id, kind, direction, code, label, origin, destination, capacity, wheelchair_capacity, facility_id)
  values (ed, 'bus', 'outbound', 'C', 'Bus C – Accueil', 'Letiště', 'Accueil Vzor', 40, 4, accueil) returning id into bus_c;

  insert into public.leg_assignments (leg_id, participant_id) values
    (flight, p_pil), (flight, p_mal), (flight, p_staff), (flight, p_assist), (bus_a, p_pil), (bus_c, p_mal), (bus_c, p_assist);
  insert into public.room_assignments (room_id, participant_id) values (r1, p_pil), (r2, p_mal), (r2, p_assist);
  insert into public.care_assignments (malade_id, carer_id, kind) values (p_mal, p_assist, 'primary');

  insert into public.events (edition_id, starts_at, title, location, audiences) values
    (ed, '2099-04-30 17:00+02', 'Mše svatá', 'Chapelle St. Joseph', '{}'),
    (ed, '2099-05-01 05:00+02', 'Budíček týmu', 'Accueil', '{staff,assistant}'),
    (ed, '2099-05-01 07:30+02', 'Mše svatá v jeskyni', 'Jeskyně', '{}'),
    (ed, '2099-05-01 21:00+02', 'Světelné procesí', 'Esplanade', '{}');
  insert into public.contacts (edition_id, label, name, phone, is_emergency) values
    (ed, 'Vedoucí pouti', 'Vedoucí Fiktivní', '+420 000 000 010', true),
    (ed, 'Lékař', 'MUDr. Fiktivní', '+420 000 000 011', true);
end $$;
