-- Code-based sign-in, part 2: role grants belong to participants (they exist before the person first signs in),
-- team rights need a valid event code, the sign-in check used by the code-login Edge Function, and throttling.
-- Organiser and medical rights still require MFA (aal2), unchanged.

-- ---------------------------------------------------------------- role grants per participant
-- user_id is superseded by participant_id. The table is empty; the column is kept (always null) so this
-- migration has no destructive statement, and can be dropped later.
alter table public.role_grants alter column user_id drop not null;
alter table public.role_grants add constraint role_grants_user_id_unused check (user_id is null);
alter table public.role_grants add column participant_id uuid not null references public.participants (id) on delete cascade;
alter table public.role_grants add constraint role_grants_participant_role unique (participant_id, role);
create index role_grants_edition on public.role_grants (edition_id);
create trigger a_inherit before insert or update on public.role_grants for each row execute function app.inherit_edition('participants', 'participant_id');

create or replace function app.has_role(p_edition uuid, p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_super_admin() and exists (select 1 from unnest(p_roles) r where r <> 'medical'))
      or (app.staff_code_valid(p_edition) and exists (
        select 1 from public.role_grants g
          join public.participants pa on pa.id = g.participant_id
          join public.profiles p on p.id = pa.user_id
        where pa.user_id = auth.uid() and p.status = 'active' and pa.edition_id = p_edition
          and g.role = any (p_roles)
          and (g.role in ('staff', 'assistant') or app.aal2()))) $$;

-- has_role never lets a super admin pass for 'medical' alone, so this is an explicit grant + MFA.
create or replace function app.is_medical(p_edition uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_role(p_edition, '{medical}') $$;

alter policy role_grants_select on public.role_grants using (
  participant_id in (select app.my_participant_ids()) or app.is_organizer(edition_id));
alter policy profiles_select on public.profiles using (
  id = (select auth.uid()) or (select app.is_super_admin()));

-- Organisers suspend or restore the account of a participant in their edition (immediate effect).
create function public.set_account_status(p_participant uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare pa public.participants;
begin
  select * into pa from public.participants where id = p_participant;
  if pa.id is null or not app.is_organizer(pa.edition_id) or p_status not in ('active', 'suspended') then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = pa.user_id and is_super_admin) and not app.is_super_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.profiles set status = p_status where id = pa.user_id;
end $$;

-- ---------------------------------------------------------------- sign-in check (called by the code-login Edge Function)
create table audit.login_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip text,
  code text,
  ok boolean not null,
  reason text
);
create index login_attempts_ip_at on audit.login_attempts (ip, at desc);
create index login_attempts_code_at on audit.login_attempts (code, at desc);

-- Throttle: 10 failures per IP or 5 per code within 15 minutes block further tries for that IP/code.
-- The answer never says which part was wrong, so it cannot be used to discover valid codes.
create function public.code_login_check(p_code text, p_staff_code text, p_ip text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare pa public.participants; sc public.staff_codes; is_team boolean; fails_ip int; fails_code int;
begin
  select count(*) filter (where ip = p_ip), count(*) filter (where code = p_code) into fails_ip, fails_code
  from audit.login_attempts where at > now() - interval '15 minutes' and not ok and (ip = p_ip or code = p_code);
  if fails_ip >= 10 or fails_code >= 5 then
    insert into audit.login_attempts (ip, code, ok, reason) values (p_ip, left(p_code, 4), false, 'throttled');
    return jsonb_build_object('ok', false, 'reason', 'throttled');
  end if;

  select p.* into pa from public.participants p join public.editions e on e.id = p.edition_id
  where p.access_code = p_code and e.status in ('draft', 'active')
  order by (e.status = 'active') desc limit 1;
  if pa.id is not null and pa.user_id is not null
     and exists (select 1 from public.profiles where id = pa.user_id and status = 'suspended') then
    pa := null;
  end if;
  is_team := pa.id is not null and exists (select 1 from public.role_grants where participant_id = pa.id);
  if is_team then
    select * into sc from public.staff_codes
    where edition_id = pa.edition_id and code = upper(trim(coalesce(p_staff_code, '')))
      and now() >= valid_from and now() < valid_until;
  end if;
  if pa.id is null or (is_team and sc.id is null) then
    insert into audit.login_attempts (ip, code, ok, reason) values (p_ip, left(p_code, 4), false, 'invalid');
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into audit.login_attempts (ip, code, ok) values (p_ip, p_code, true);
  return jsonb_build_object('ok', true, 'participant_id', pa.id, 'user_id', pa.user_id, 'edition_id', pa.edition_id,
                            'staff_code_id', sc.id, 'team', is_team);
end $$;

-- Links a freshly created auth user to the participant and records the event code used.
create function public.code_login_link(p_participant uuid, p_user uuid, p_staff_code uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.participants set user_id = p_user where id = p_participant and (user_id is null or user_id = p_user);
  if not found then
    raise exception 'participant already linked to another account' using errcode = '23505';
  end if;
  update public.profiles set staff_code_id = p_staff_code where id = p_user;
end $$;

revoke execute on function public.code_login_check, public.code_login_link from public, anon, authenticated;
grant execute on function public.code_login_check, public.code_login_link to service_role;
grant execute on function public.set_account_status to authenticated;
revoke execute on function app.random_access_code from authenticated;

-- ---------------------------------------------------------------- my_pilgrimage: roles come from the participant now
create or replace function app.my_roles(p_edition uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(g.role), '[]') from public.role_grants g join public.participants pa on pa.id = g.participant_id
  where pa.user_id = auth.uid() and pa.edition_id = p_edition and app.has_role(p_edition, array[g.role]) $$;
revoke execute on function app.my_roles from authenticated;

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
        'title', ev.title, 'location', ev.location, 'description', ev.description, 'updated_at', ev.updated_at,
        'changed', ev.version > 1) order by ev.starts_at)
      from public.events ev where ev.edition_id = ed.id
        and (cardinality(ev.audiences) = 0 or me.category = any (ev.audiences) or app.is_team(ed.id))), '[]'),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('label', c.label, 'name', c.name, 'phone', c.phone,
        'is_emergency', c.is_emergency) order by c.is_emergency desc, c.sort)
      from public.contacts c where c.edition_id = ed.id
        and (cardinality(c.audiences) = 0 or me.category = any (c.audiences) or app.is_team(ed.id))), '[]'),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body,
        'critical', a.critical, 'published_at', a.published_at,
        'acked', exists (select 1 from public.announcement_acks k where k.announcement_id = a.id and k.user_id = auth.uid()))
        order by a.published_at desc)
      from public.announcements a where a.edition_id = ed.id and a.published_at <= now()
        and (cardinality(a.audiences) = 0 or me.category = any (a.audiences) or app.is_team(ed.id))), '[]'));
end $$;

-- ---------------------------------------------------------------- indexes suggested by the performance advisor
create index if not exists participants_edition on public.participants (edition_id);
create index if not exists leg_assignments_edition on public.leg_assignments (edition_id);
create index if not exists room_assignments_edition on public.room_assignments (edition_id);
create index if not exists care_assignments_edition on public.care_assignments (edition_id);
create index if not exists transport_legs_edition on public.transport_legs (edition_id);
create index if not exists rooms_edition on public.rooms (edition_id);
create index if not exists facilities_edition on public.facilities (edition_id);
create index if not exists credentials_edition on public.credentials (edition_id);
create index if not exists contacts_edition on public.contacts (edition_id);
create index if not exists announcements_edition on public.announcements (edition_id);
