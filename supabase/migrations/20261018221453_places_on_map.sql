-- Map support: my_pilgrimage returns the places (shared + this edition's) and each event's place, so the
-- participant app can show the Lourdes map offline from the same cached payload.
-- Shared places of the sanctuary, positions from OpenStreetMap (© OpenStreetMap contributors, ODbL),
-- looked up via Nominatim on 2026-10-18. Organisers can correct or extend them in the admin.

insert into public.places (edition_id, name, kind, description, lat, lng, sort) values
  (null, 'Jeskyně Massabielle', 'sanctuary', 'Místo zjevení Panny Marie svaté Bernadetě. Mše svaté u jeskyně, pramen.', 43.097536, -0.058521, 10),
  (null, 'Bazilika Panny Marie Růžencové', 'sanctuary', 'Dolní bazilika na Esplanadě; mše a pomazání nemocných.', 43.097496, -0.057464, 20),
  (null, 'Bazilika Neposkvrněného početí', 'sanctuary', 'Horní bazilika nad jeskyní.', 43.097419, -0.058282, 30),
  (null, 'Podzemní bazilika sv. Pia X.', 'sanctuary', 'Velká podzemní bazilika; pontifikální mše, eucharistické procesí za deště.', 43.097269, -0.053409, 40),
  (null, 'Lázně (Piscines)', 'sanctuary', 'Koupele v lurdské vodě.', 43.097563, -0.060179, 50),
  (null, 'Esplanade', 'sanctuary', 'Prostranství před bazilikami; světelné a eucharistické procesí.', 43.097821, -0.054221, 60),
  (null, 'Kaple sv. Josefa', 'sanctuary', 'Kaple u vstupu do svatyně.', 43.098212, -0.053307, 70),
  (null, 'Brána sv. Michala (hlavní vchod)', 'entrance', 'Hlavní vstup do svatyně u mostu Saint-Michel.', 43.098144, -0.051035, 80),
  (null, 'Accueil Notre-Dame', 'care', 'Ubytování nemocných a části týmu.', 43.099104, -0.056479, 90),
  (null, 'Křížová cesta (Espélugues)', 'sanctuary', 'Křížová cesta na kopci nad svatyní.', 43.096022, -0.058103, 100),
  (null, 'Prairie', 'sanctuary', 'Louka na druhém břehu Gavy; křížová cesta pro nemocné.', 43.099410, -0.061280, 110),
  (null, 'Abri Saint-Michel', 'meals', 'Jídelna u hlavního vchodu (obědy a večeře týmu).', 43.098366, -0.051557, 120),
  (null, 'Informační centrum svatyně', 'info', 'Informace, ztráty a nálezy.', 43.097301, -0.055340, 130),
  (null, 'Letiště Tarbes-Lourdes-Pyrénées', 'transport', 'Letiště, kam přilétá charter.', 43.179176, -0.000380, 200);

create or replace function public.my_pilgrimage(p_edition uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ed public.editions; me public.participants;
begin
  if not app.active_user() then
    return null;
  end if;
  select * into ed from public.editions e
  where (e.id = p_edition or (p_edition is null and e.status = 'active')) and app.is_member(e.id);
  if ed.id is null then
    return null;
  end if;
  select * into me from public.participants where edition_id = ed.id and user_id = auth.uid();
  return jsonb_build_object(
    'generated_at', now(),
    'edition', jsonb_build_object('id', ed.id, 'year', ed.year, 'title', ed.title, 'starts_on', ed.starts_on,
                                  'ends_on', ed.ends_on, 'timezone', ed.timezone, 'emergency_phone', ed.emergency_phone),
    'roles', app.my_roles(ed.id),
    'me', case when me.id is null then null else jsonb_build_object(
      'id', me.id, 'category', me.category, 'title', me.title, 'first_name', me.first_name, 'last_name', me.last_name,
      'preferred_name', me.preferred_name, 'language', me.language, 'mobility', me.mobility) end,
    'legs', coalesce((select jsonb_agg(jsonb_build_object(
        'leg_id', l.id, 'kind', l.kind, 'direction', l.direction, 'code', l.code, 'label', l.label,
        'origin', l.origin, 'destination', l.destination, 'departs_at', l.departs_at, 'arrives_at', l.arrives_at,
        'meeting_point', l.meeting_point, 'meeting_at', l.meeting_at, 'note', l.note,
        'responsible', (select r.first_name || ' ' || r.last_name from public.participants r where r.id = l.responsible_id),
        'boarded_at', la.boarded_at, 'arrived_at', la.arrived_at, 'updated_at', greatest(l.updated_at, la.updated_at))
        order by l.departs_at nulls last, l.sort)
      from public.leg_assignments la join public.transport_legs l on l.id = la.leg_id where la.participant_id = me.id), '[]'),
    'accommodation', (select jsonb_build_object(
        'facility', f.name, 'facility_kind', f.kind, 'address', f.address, 'phone', f.phone, 'lat', f.lat, 'lng', f.lng,
        'note', f.note, 'room', r.number, 'floor', r.floor, 'zone', r.zone, 'bed', ra.bed,
        'updated_at', greatest(ra.updated_at, r.updated_at))
      from public.room_assignments ra join public.rooms r on r.id = ra.room_id join public.facilities f on f.id = r.facility_id
      where ra.participant_id = me.id),
    'carers', coalesce((select jsonb_agg(jsonb_build_object('name', c.first_name || ' ' || c.last_name, 'phone', c.phone, 'kind', ca.kind))
      from public.care_assignments ca join public.participants c on c.id = ca.carer_id
      where ca.malade_id = me.id and (ca.starts_at is null or ca.starts_at <= now()) and (ca.ends_at is null or ca.ends_at > now())), '[]'),
    'in_care', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.first_name || ' ' || m.last_name, 'kind', ca.kind, 'starts_at', ca.starts_at, 'ends_at', ca.ends_at,
        'room', (select r.number from public.room_assignments ra join public.rooms r on r.id = ra.room_id where ra.participant_id = m.id)))
      from public.care_assignments ca join public.participants m on m.id = ca.malade_id
      where ca.carer_id = me.id and (ca.ends_at is null or ca.ends_at > now())), '[]'),
    'duties', coalesce((select jsonb_agg(jsonb_build_object('title', d.title, 'starts_at', d.starts_at, 'ends_at', d.ends_at,
        'location', d.location, 'note', d.note) order by d.starts_at)
      from public.duty_assignments da join public.duties d on d.id = da.duty_id
      where da.participant_id = me.id and d.ends_at > now()), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', ev.id, 'starts_at', ev.starts_at, 'ends_at', ev.ends_at,
        'title', ev.title, 'location', ev.location, 'place_id', ev.place_id, 'description', ev.description,
        'updated_at', ev.updated_at, 'changed', ev.version > 1) order by ev.starts_at)
      from public.events ev where ev.edition_id = ed.id
        and (cardinality(ev.audiences) = 0 or me.category = any (ev.audiences) or app.is_team(ed.id))), '[]'),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('label', c.label, 'name', c.name, 'phone', c.phone,
        'is_emergency', c.is_emergency) order by c.is_emergency desc, c.sort)
      from public.contacts c where c.edition_id = ed.id
        and (cardinality(c.audiences) = 0 or me.category = any (c.audiences) or app.is_team(ed.id))), '[]'),
    'places', coalesce((select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.name, 'kind', pl.kind,
        'description', pl.description, 'accessibility', pl.accessibility, 'directions', pl.directions, 'lat', pl.lat, 'lng', pl.lng)
        order by pl.sort, pl.name)
      from public.places pl where pl.edition_id is null or pl.edition_id = ed.id), '[]'),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body,
        'critical', a.critical, 'published_at', a.published_at,
        'acked', exists (select 1 from public.announcement_acks k where k.announcement_id = a.id and k.user_id = auth.uid()))
        order by a.published_at desc)
      from public.announcements a where a.edition_id = ed.id and a.published_at <= now()
        and (cardinality(a.audiences) = 0 or me.category = any (a.audiences) or app.is_team(ed.id))), '[]'));
end $$;
