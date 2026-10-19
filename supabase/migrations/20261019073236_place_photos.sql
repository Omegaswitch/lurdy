-- Photos for the places card in the app. Only freely licensed images, each with author, licence and a link to its
-- source page (the licence requires it). Images are loaded from Wikimedia's servers; mirror them into our own
-- storage before production if we do not want to depend on (or reveal app users' IPs to) Wikimedia.
alter table public.places
  add column photo_url text check (photo_url ~ '^https://'),
  add column photo_credit text check (char_length(photo_credit) <= 200),
  add column photo_source text check (photo_source ~ '^https://'),
  add constraint places_photo_credited check (photo_url is null or (photo_credit is not null and photo_source is not null));

update public.places p set photo_url = v.url, photo_credit = v.credit, photo_source = v.src
from (values
  ('Jeskyně Massabielle', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/France-002018_-_Grotto_Service_%2815153278134%29.jpg/960px-France-002018_-_Grotto_Service_%2815153278134%29.jpg',
   'Dennis G. Jarvis, CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:France-002018_-_Grotto_Service_(15153278134).jpg'),
  ('Bazilika Panny Marie Růžencové', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Rosary_Basilica_in_Lourdes%2C_9_August_2019.jpg/960px-Rosary_Basilica_in_Lourdes%2C_9_August_2019.jpg',
   'Alexey Komarov, CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Rosary_Basilica_in_Lourdes,_9_August_2019.jpg'),
  ('Bazilika Neposkvrněného početí', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Lourdes_Basilique_et_gave.jpg/960px-Lourdes_Basilique_et_gave.jpg',
   'Roland Darré, CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Lourdes_Basilique_et_gave.jpg'),
  ('Letiště Tarbes-Lourdes-Pyrénées', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Tarbes-Lourdes-_Pyr%C3%A9n%C3%A9es_Airport_overview_in_2025.jpg/960px-Tarbes-Lourdes-_Pyr%C3%A9n%C3%A9es_Airport_overview_in_2025.jpg',
   'Hugo LUC, CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Tarbes-Lourdes-_Pyr%C3%A9n%C3%A9es_Airport_overview_in_2025.jpg')
) v(name, url, credit, src)
where p.edition_id is null and p.name = v.name;

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
        'description', pl.description, 'accessibility', pl.accessibility, 'directions', pl.directions, 'lat', pl.lat, 'lng', pl.lng,
        'photo_url', pl.photo_url, 'photo_credit', pl.photo_credit, 'photo_source', pl.photo_source)
        order by pl.sort, pl.name)
      from public.places pl where pl.edition_id is null or pl.edition_id = ed.id), '[]'),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body,
        'critical', a.critical, 'published_at', a.published_at,
        'acked', exists (select 1 from public.announcement_acks k where k.announcement_id = a.id and k.user_id = auth.uid()))
        order by a.published_at desc)
      from public.announcements a where a.edition_id = ed.id and a.published_at <= now()
        and (cardinality(a.audiences) = 0 or me.category = any (a.audiences) or app.is_team(ed.id))), '[]'));
end $$;
