-- QR credentials, scan log, and the RPC functions the clients call:
--   scan_badge / staff_action / participant_card  (staff scanner)
--   issue_credential / revoke_credential           (organiser, badge printing)
--   my_pilgrimage / my_digital_credential          (participant app)
-- QR text is 'LRD1.' + 32 hex characters (122 random bits); only sha256 of the hex part is stored.

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  kind public.credential_kind not null default 'card',
  token_hash bytea not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid default auth.uid(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text check (char_length(revoke_reason) <= 200)
);
create unique index credentials_one_active on public.credentials (participant_id, kind) where revoked_at is null;

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  credential_id uuid references public.credentials (id) on delete set null,
  leg_id uuid references public.transport_legs (id) on delete set null,
  action public.scan_action not null,
  result text not null,
  client_scan_id uuid unique,
  scanned_by uuid not null default auth.uid(),
  scanned_at timestamptz not null default now()
);
create index scans_edition_at on public.scans (edition_id, scanned_at desc);

alter table public.credentials enable row level security;
alter table public.scans enable row level security;
-- No direct writes: credentials are issued and scans recorded only by the functions below.
create policy credentials_read on public.credentials for select to authenticated using (app.is_staff(edition_id));
create policy scans_read on public.scans for select to authenticated using (app.is_staff(edition_id));
revoke insert, update, delete on public.credentials, public.scans from authenticated;
revoke all on public.credentials, public.scans from anon;
create trigger z_audit after insert or update on public.credentials for each row execute function app.audit();

-- ---------------------------------------------------------------- operational card (what a scanner shows)
-- No medical data. Emergency contacts are included because staff need them in the field.
create function app.participant_card(p_participant uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'edition_id', p.edition_id, 'category', p.category, 'title', p.title,
    'first_name', p.first_name, 'last_name', p.last_name, 'preferred_name', p.preferred_name,
    'phone', p.phone, 'language', p.language, 'mobility', p.mobility,
    'logistics_note', p.logistics_note, 'photo_path', p.photo_path, 'version', p.version,
    'room', (select jsonb_build_object('room_id', r.id, 'number', r.number, 'floor', r.floor, 'zone', r.zone, 'bed', ra.bed,
                                       'checked_in_at', ra.checked_in_at, 'facility', f.name, 'facility_label', f.short_label,
                                       'facility_kind', f.kind, 'colour', f.colour)
             from public.room_assignments ra join public.rooms r on r.id = ra.room_id join public.facilities f on f.id = r.facility_id
             where ra.participant_id = p.id),
    'legs', coalesce((select jsonb_agg(jsonb_build_object('leg_id', l.id, 'kind', l.kind, 'direction', l.direction, 'code', l.code,
                                       'label', l.label, 'departs_at', l.departs_at, 'boarded_at', la.boarded_at, 'arrived_at', la.arrived_at)
                                       order by l.departs_at nulls last, l.sort)
             from public.leg_assignments la join public.transport_legs l on l.id = la.leg_id where la.participant_id = p.id), '[]'),
    'carers', coalesce((select jsonb_agg(jsonb_build_object('name', c.first_name || ' ' || c.last_name, 'phone', c.phone, 'kind', ca.kind))
             from public.care_assignments ca join public.participants c on c.id = ca.carer_id
             where ca.malade_id = p.id and (ca.starts_at is null or ca.starts_at <= now()) and (ca.ends_at is null or ca.ends_at > now())), '[]'),
    'in_care', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.first_name || ' ' || m.last_name, 'kind', ca.kind))
             from public.care_assignments ca join public.participants m on m.id = ca.malade_id
             where ca.carer_id = p.id and (ca.starts_at is null or ca.starts_at <= now()) and (ca.ends_at is null or ca.ends_at > now())), '[]'),
    'teams', coalesce((select jsonb_agg(t.name order by t.name) from public.team_members tm join public.teams t on t.id = tm.team_id
             where tm.participant_id = p.id), '[]'),
    'emergency_contacts', coalesce((select jsonb_agg(jsonb_build_object('name', e.name, 'relation', e.relation, 'phone', e.phone) order by e.sort)
             from public.emergency_contacts e where e.participant_id = p.id), '[]'))
  from public.participants p where p.id = p_participant $$;

-- Records a staff action for a participant and returns the result code. Caller is already authorised.
create function app.apply_action(p_participant uuid, p_action public.scan_action, p_leg uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_action = 'lookup' then
    return 'ok';
  elsif p_action in ('board', 'arrive') then
    if p_leg is null then
      return 'leg_required';
    end if;
    if p_action = 'board' then
      update public.leg_assignments set boarded_at = coalesce(boarded_at, now()), boarded_by = coalesce(boarded_by, auth.uid())
      where leg_id = p_leg and participant_id = p_participant;
    else
      update public.leg_assignments set arrived_at = coalesce(arrived_at, now()), arrived_by = coalesce(arrived_by, auth.uid()),
                                        boarded_at = coalesce(boarded_at, now()), boarded_by = coalesce(boarded_by, auth.uid())
      where leg_id = p_leg and participant_id = p_participant;
    end if;
    get diagnostics n = row_count;
    return case when n = 0 then 'wrong_leg' else 'ok' end;
  else -- check_in
    update public.room_assignments set checked_in_at = coalesce(checked_in_at, now()) where participant_id = p_participant;
    get diagnostics n = row_count;
    return case when n = 0 then 'no_room' else 'ok' end;
  end if;
end $$;

-- ---------------------------------------------------------------- scanner RPCs
-- Resolves a badge QR to the live record. Without a staff grant for the badge's edition the
-- caller learns nothing, not even whether the badge exists.
create function public.scan_badge(p_payload text, p_action public.scan_action default 'lookup',
                                  p_leg uuid default null, p_client_scan_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text; cred public.credentials; res text; pid uuid;
begin
  -- Offline replays: the same client_scan_id is recorded once and answered from the first result.
  if p_client_scan_id is not null and exists (select 1 from public.scans where client_scan_id = p_client_scan_id) then
    select s.result, s.participant_id into res, pid from public.scans s
    where s.client_scan_id = p_client_scan_id and s.scanned_by = auth.uid() and app.is_staff(s.edition_id);
    if res is null then
      return jsonb_build_object('result', 'not_authorized');
    end if;
    return jsonb_build_object('result', res, 'replayed', true, 'participant', app.participant_card(pid));
  end if;

  token := upper((regexp_match(trim(p_payload), '^LRD1\.([0-9A-Fa-f]{32})$'))[1]);
  if token is null then
    return jsonb_build_object('result', 'invalid');
  end if;
  select * into cred from public.credentials where token_hash = sha256(convert_to(token, 'UTF8'));
  if cred.id is null or not app.is_staff(cred.edition_id) then
    return jsonb_build_object('result', 'not_authorized');
  end if;
  if cred.revoked_at is not null then
    res := 'revoked';
  elsif p_leg is not null and not exists (select 1 from public.transport_legs where id = p_leg and edition_id = cred.edition_id) then
    res := 'wrong_leg';
  else
    res := app.apply_action(cred.participant_id, p_action, p_leg);
  end if;
  insert into public.scans (edition_id, participant_id, credential_id, leg_id, action, result, client_scan_id)
  values (cred.edition_id, cred.participant_id, cred.id, p_leg, p_action, res, p_client_scan_id);
  return jsonb_build_object('result', res, 'credential_kind', cred.kind, 'participant', app.participant_card(cred.participant_id));
end $$;

-- Same actions without a badge (manual search fallback).
create function public.staff_action(p_participant uuid, p_action public.scan_action,
                                    p_leg uuid default null, p_client_scan_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ed uuid; res text;
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_staff(ed) then
    return jsonb_build_object('result', 'not_authorized');
  end if;
  if p_client_scan_id is not null and exists (select 1 from public.scans where client_scan_id = p_client_scan_id) then
    return jsonb_build_object('result', 'ok', 'replayed', true, 'participant', app.participant_card(p_participant));
  end if;
  if p_leg is not null and not exists (select 1 from public.transport_legs where id = p_leg and edition_id = ed) then
    res := 'wrong_leg';
  else
    res := app.apply_action(p_participant, p_action, p_leg);
  end if;
  insert into public.scans (edition_id, participant_id, leg_id, action, result, client_scan_id)
  values (ed, p_participant, p_leg, p_action, res, p_client_scan_id);
  return jsonb_build_object('result', res, 'participant', app.participant_card(p_participant));
end $$;

create function public.participant_card(p_participant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ed uuid;
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not (app.is_staff(ed) or app.is_carer_of(p_participant)) then
    return null;
  end if;
  return app.participant_card(p_participant);
end $$;

-- ---------------------------------------------------------------- credentials
create function app.new_token() returns text language sql volatile set search_path = '' as $$
  select upper(replace(gen_random_uuid()::text, '-', '')) $$;

-- Issues a new badge credential (revoking the previous one of the same kind) and returns the QR text once.
create function public.issue_credential(p_participant uuid, p_kind public.credential_kind default 'card') returns text
language plpgsql security definer set search_path = '' as $$
declare ed uuid; token text := app.new_token();
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_organizer(ed) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'replaced'
  where participant_id = p_participant and kind = p_kind and revoked_at is null;
  insert into public.credentials (edition_id, participant_id, kind, token_hash)
  values (ed, p_participant, p_kind, sha256(convert_to(token, 'UTF8')));
  return 'LRD1.' || token;
end $$;

create function public.revoke_credential(p_participant uuid, p_reason text default 'lost') returns void
language plpgsql security definer set search_path = '' as $$
declare ed uuid;
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_organizer(ed) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left(p_reason, 200)
  where participant_id = p_participant and kind = 'card' and revoked_at is null;
end $$;

-- The participant's on-screen QR. A new one replaces the previous digital one (e.g. new phone).
create function public.my_digital_credential(p_edition uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare pid uuid; ed uuid; token text := app.new_token();
begin
  select pa.id, pa.edition_id into pid, ed from public.participants pa join public.editions e on e.id = pa.edition_id
  where pa.user_id = auth.uid() and app.active_user()
    and (pa.edition_id = p_edition or (p_edition is null and e.status = 'active'));
  if pid is null then
    raise exception 'no participation' using errcode = '42501';
  end if;
  update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'replaced'
  where participant_id = pid and kind = 'digital' and revoked_at is null;
  insert into public.credentials (edition_id, participant_id, kind, token_hash, issued_by)
  values (ed, pid, 'digital', sha256(convert_to(token, 'UTF8')), auth.uid());
  return 'LRD1.' || token;
end $$;

-- ---------------------------------------------------------------- participant app payload
-- Everything the participant app shows, in one call; the app caches it for offline use.
-- Never contains other participants' data except carers' / cared-for persons' names and room.
create function public.my_pilgrimage(p_edition uuid default null) returns jsonb
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
    'roles', coalesce((select jsonb_agg(g.role) from public.role_grants g where g.user_id = auth.uid() and g.edition_id = ed.id), '[]'),
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

-- Functions are callable by signed-in users only (each checks authorisation itself).
revoke execute on all functions in schema public from public, anon;
grant execute on function public.scan_badge, public.staff_action, public.participant_card, public.issue_credential,
  public.revoke_credential, public.my_digital_credential, public.my_pilgrimage to authenticated;
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
-- Internal building blocks: reachable only through the checked public functions above.
revoke execute on function app.participant_card, app.apply_action, app.new_token from authenticated;
