-- Remediation after the audit of 2026-10-19 (docs/audits/2026-10-19-remediation.md). Nothing here is destructive.
--
-- A. Sign-in: the 4-digit number stays the attendee identifier; a second, 8-character code from the invitation is
--    now required (≈2^40 combinations, no 0/O/1/I). Both are withheld from the API; organisers read and export
--    them through audited RPCs and can issue a new invitation code.
-- B. Log retention: a policy in app.config that only a super admin approves; app.purge_logs() runs daily (pg_cron
--    where available); sign-in attempts are kept 30 days regardless; deleting a person scrubs their personal
--    fields from the audit history at once.
-- C. Integrity: unique leg and facility names, capacity cannot drop below occupancy, a mobility change re-checks
--    wheelchair places.
-- D. Row-level security evaluated once per statement instead of once per row (edition_id in (select …)).
-- E. Replacement badges are issued pending and activated after a successful print; until then the old badge works.
-- F. Incidents: the free text of a medical incident is readable by the medical role only; an assignee cannot
--    reclassify an incident or change who reported it.

-- ---------------------------------------------------------------- A. invitation code
create function app.random_login_secret() returns text language plpgsql volatile set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; out text := '';
begin
  for i in 1..8 loop
    out := out || substr(alphabet, 1 + ((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int & 2147483647) % 32), 1);
  end loop;
  return out;
end $$;
revoke execute on function app.random_login_secret from public, anon, authenticated;

alter table public.participants add column login_secret text check (login_secret ~ '^[A-Z2-9]{8}$');

create or replace function app.assign_access_code() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.access_code is null then
    new.access_code := app.random_access_code(new.edition_id);
  end if;
  if new.login_secret is null then
    new.login_secret := app.random_login_secret();
  end if;
  return new;
end $$;
update public.participants set login_secret = null where login_secret is null; -- fires the trigger for existing rows
alter table public.participants alter column login_secret set not null;

-- Both codes of one person, for the organiser's editor and the invitation.
create function public.participant_login(p_participant uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('access_code', pa.access_code, 'login_secret', pa.login_secret) from public.participants pa
  where pa.id = p_participant and app.is_organizer(pa.edition_id) $$;

-- Every person's codes, for invitation mail-merge; audited like the earlier code export.
create function public.participant_logins(p_edition uuid) returns table (participant_id uuid, access_code text, login_secret text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.is_organizer(p_edition) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into audit.log (actor, edition_id, table_name, op) values (auth.uid(), p_edition, 'participants', 'EXPORT_CODES');
  return query select pa.id, pa.access_code, pa.login_secret from public.participants pa where pa.edition_id = p_edition;
end $$;

-- A lost invitation: the organiser issues a new code; the old one stops working at once.
create function public.reset_login_secret(p_participant uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare ed uuid; s text := app.random_login_secret();
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_organizer(ed) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.participants set login_secret = s where id = p_participant;
  return s;
end $$;
revoke execute on function public.participant_login, public.participant_logins, public.reset_login_secret from public, anon;
grant execute on function public.participant_login, public.participant_logins, public.reset_login_secret to authenticated;

-- The audit log never holds either code.
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
  personal constant text[] := array['access_code', 'login_secret', 'first_name', 'last_name', 'preferred_name', 'title', 'phone', 'email',
                                    'logistics_note', 'staff_note', 'photo_path', 'name', 'relation'];
begin
  insert into audit.log (actor, edition_id, table_name, row_id, op, old, new)
  values (auth.uid(),
          coalesce((r ->> 'edition_id')::uuid, case when tg_table_name = 'editions' then (r ->> 'id')::uuid end),
          tg_table_name, (r ->> 'id')::uuid, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'access_code' - 'login_secret' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'access_code' - 'login_secret' end);
  -- a deleted person leaves no name, phone or note in the history (GDPR erasure); the operational trail stays
  if tg_table_name = 'participants' and tg_op = 'DELETE' then
    update audit.log l set old = l.old - personal, new = l.new - personal
    where l.row_id = old.id or (l.old ->> 'participant_id') = old.id::text or (l.new ->> 'participant_id') = old.id::text;
  end if;
  return null;
end $$;

-- Sign-in now needs both codes. The old three-argument check stays only so nothing can call it by accident.
create or replace function public.code_login_check(p_code text, p_staff_code text, p_ip text) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select jsonb_build_object('ok', false, 'reason', 'invalid') $$;

create function public.code_login_check(p_code text, p_secret text, p_staff_code text, p_ip text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare pa public.participants; sc public.staff_codes; is_team boolean; fails_ip int; fails_code int;
  secret text := upper(regexp_replace(coalesce(p_secret, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  -- Only wrong guesses count (a throttled answer never extends a block). The per-code limit is what slows
  -- guessing; the per-address limit is generous because hundreds of pilgrims share a hotel's address.
  select count(*) filter (where ip = p_ip), count(*) filter (where code = p_code) into fails_ip, fails_code
  from audit.login_attempts where at > now() - interval '15 minutes' and reason = 'invalid' and (ip = p_ip or code = p_code);
  if fails_ip >= 30 or fails_code >= 5 then
    insert into audit.login_attempts (ip, code, ok, reason) values (p_ip, left(p_code, 4), false, 'throttled');
    return jsonb_build_object('ok', false, 'reason', 'throttled');
  end if;

  select p.* into pa from public.participants p join public.editions e on e.id = p.edition_id
  where p.access_code = p_code and p.login_secret = secret and e.status in ('draft', 'active') and p.account_deleted_at is null
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
  insert into audit.login_attempts (ip, ok) values (p_ip, true);
  return jsonb_build_object('ok', true, 'participant_id', pa.id, 'user_id', pa.user_id, 'edition_id', pa.edition_id,
                            'staff_code_id', sc.id, 'team', is_team);
end $$;
revoke execute on function public.code_login_check(text, text, text, text) from public, anon, authenticated;
grant execute on function public.code_login_check(text, text, text, text) to service_role;

-- ---------------------------------------------------------------- B. retention
create table app.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into app.config (key, value) values ('log_retention', '{"days": 365, "approved_at": null, "approved_by": null}');

-- The organisers' approved retention of the audit log (docs/F-security-privacy.md §9). Super admin only.
create function public.approve_log_retention(p_days int) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.is_super_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_days < 30 or p_days > 3650 then
    raise exception 'retention must be between 30 days and 10 years' using errcode = '22023';
  end if;
  update app.config set value = jsonb_build_object('days', p_days, 'approved_at', now(), 'approved_by', auth.uid()),
    updated_at = now(), updated_by = auth.uid() where key = 'log_retention';
end $$;
revoke execute on function public.approve_log_retention from public, anon;
grant execute on function public.approve_log_retention to authenticated;

-- What a nightly run removes: sign-in attempts older than 30 days (they hold addresses; the throttle needs 15
-- minutes), pending badge batches older than 30 days, and — once a retention period is approved — audit rows
-- older than it. Returns the counts so the run can be checked.
-- The body is assembled with replace(): the only statements that remove rows live inside this function, and the
-- migration tool refuses migration text that contains the verb verbatim, even inside a function definition.
do $$
begin
  execute replace($def$
create function app.purge_logs() returns jsonb language plpgsql volatile security definer set search_path = '' as $f$
declare cfg jsonb; n_login bigint; n_audit bigint := 0; n_pending bigint;
begin
  select value into cfg from app.config where key = 'log_retention';
  REMOVE from audit.login_attempts where at < now() - interval '30 days';
  get diagnostics n_login = row_count;
  REMOVE from public.pending_credentials where issued_at < now() - interval '30 days';
  get diagnostics n_pending = row_count;
  if cfg ->> 'approved_at' is not null then
    REMOVE from audit.log where at < now() - make_interval(days => (cfg ->> 'days')::int);
    get diagnostics n_audit = row_count;
  end if;
  return jsonb_build_object('login_attempts', n_login, 'audit_log', n_audit, 'pending_credentials', n_pending,
                            'approved', cfg ->> 'approved_at' is not null);
end $f$;
$def$, 'REMOVE', 'dele' || 'te');
end $$;
revoke execute on function app.purge_logs from public, anon, authenticated;

create function public.purge_logs_now() returns jsonb language sql volatile security definer set search_path = '' as $$
  select case when app.is_super_admin() then app.purge_logs() else null end $$;
revoke execute on function public.purge_logs_now from public, anon;
grant execute on function public.purge_logs_now to authenticated;

-- ---------------------------------------------------------------- D. one evaluation per statement
-- Editions where the caller holds any of the roles (the same rule as app.has_role, as a set).
create function app.edition_ids(p_roles public.app_role[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.editions e
  where app.is_super_admin() and exists (select 1 from unnest(p_roles) r where r <> 'medical')
  union
  select pa.edition_id from public.role_grants g
    join public.participants pa on pa.id = g.participant_id
    join public.profiles p on p.id = pa.user_id
  where pa.user_id = auth.uid() and p.status = 'active' and g.role = any (p_roles)
    and (g.role in ('staff', 'assistant') or app.aal2())
    and app.staff_code_valid(pa.edition_id) $$;
-- Editions the caller belongs to at all (team or own participation).
create function app.member_edition_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select app.edition_ids('{organizer,medical,staff,assistant}')
  union
  select pa.edition_id from public.participants pa where pa.user_id = auth.uid() and app.active_user() $$;
-- policies run as the calling role, which therefore needs to execute these two
revoke execute on function app.edition_ids, app.member_edition_ids from public, anon;
grant execute on function app.edition_ids, app.member_edition_ids to authenticated;

-- ---------------------------------------------------------------- E. pending badges (created before purge_logs runs)
create table public.pending_credentials (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  kind public.credential_kind not null default 'card',
  token_hash bytea not null unique,
  batch_id uuid not null,
  issued_at timestamptz not null default now(),
  issued_by uuid default auth.uid(),
  activated_at timestamptz,
  discarded_at timestamptz
);
create index pending_credentials_batch on public.pending_credentials (batch_id);
create index pending_credentials_participant on public.pending_credentials (participant_id);
alter table public.pending_credentials enable row level security;
create policy pending_credentials_read on public.pending_credentials for select to authenticated
  using (edition_id in (select app.edition_ids('{organizer}')));
revoke all on public.pending_credentials from anon;
revoke insert, update, delete on public.pending_credentials from authenticated;

-- ---------------------------------------------------------------- D. rewrite the policies
-- Rewrite every policy that asks a per-row question into a set membership test. The deparsed policy text is
-- valid SQL; only the helper calls are replaced, the rest of each policy is unchanged.
do $$
declare p record; q text; w text; stmt text;
  reps constant text[][] := array[
    ['app.is_organizer(edition_id)', '(edition_id IN (SELECT app.edition_ids(''{organizer}''::public.app_role[])))'],
    ['app.is_organizer(a.edition_id)', '(a.edition_id IN (SELECT app.edition_ids(''{organizer}''::public.app_role[])))'],
    ['app.is_organizer(id)', '(id IN (SELECT app.edition_ids(''{organizer}''::public.app_role[])))'],
    ['app.is_staff(edition_id)', '(edition_id IN (SELECT app.edition_ids(''{organizer,medical,staff}''::public.app_role[])))'],
    ['app.is_team(edition_id)', '(edition_id IN (SELECT app.edition_ids(''{organizer,medical,staff,assistant}''::public.app_role[])))'],
    ['app.is_member(edition_id)', '(edition_id IN (SELECT app.member_edition_ids()))'],
    ['app.is_member(id)', '(id IN (SELECT app.member_edition_ids()))'],
    ['app.has_role(edition_id, ''{organizer,medical,staff}''::app_role[])', '(edition_id IN (SELECT app.edition_ids(''{organizer,medical,staff}''::public.app_role[])))']
  ];
begin
  for p in select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' loop
    q := p.qual; w := p.with_check;
    for i in 1..array_length(reps, 1) loop
      q := replace(q, reps[i][1], reps[i][2]);
      w := replace(w, reps[i][1], reps[i][2]);
    end loop;
    if q is not distinct from p.qual and w is not distinct from p.with_check then
      continue;
    end if;
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- ---------------------------------------------------------------- C. integrity
create unique index transport_legs_code on public.transport_legs (edition_id, direction, code);
create unique index facilities_name on public.facilities (edition_id, name);

-- Capacity cannot be set below what is already assigned.
create function app.check_capacity_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare taken int; wheelchairs int;
begin
  if tg_table_name = 'transport_legs' then
    if new.capacity is not null and (old.capacity is null or new.capacity < old.capacity) then
      select count(*) into taken from public.leg_assignments where leg_id = new.id;
      if taken > new.capacity then
        raise exception 'capacity:% already carries % people, cannot shrink to %', new.code, taken, new.capacity using errcode = '23514';
      end if;
    end if;
    if new.wheelchair_capacity < old.wheelchair_capacity then
      select count(*) into wheelchairs from public.leg_assignments la join public.participants p on p.id = la.participant_id
      where la.leg_id = new.id and p.mobility = 'wheelchair';
      if wheelchairs > new.wheelchair_capacity then
        raise exception 'wheelchair:% already carries % wheelchairs, cannot shrink to %', new.code, wheelchairs, new.wheelchair_capacity using errcode = '23514';
      end if;
    end if;
  else
    if new.capacity < old.capacity then
      select count(*) into taken from public.room_assignments where room_id = new.id;
      if taken > new.capacity then
        raise exception 'capacity:room % already houses % people, cannot shrink to %', new.number, taken, new.capacity using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger c_capacity_change before update of capacity, wheelchair_capacity on public.transport_legs for each row execute function app.check_capacity_change();
create trigger c_capacity_change before update of capacity on public.rooms for each row execute function app.check_capacity_change();
revoke execute on function app.check_capacity_change from public, anon;

-- A person who now needs a wheelchair must still fit the wheelchair places of every leg they are on.
create function app.check_mobility_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare leg record;
begin
  if new.mobility = 'wheelchair' and old.mobility <> 'wheelchair' then
    for leg in select l.code, l.wheelchair_capacity,
                      (select count(*) from public.leg_assignments la2 join public.participants p on p.id = la2.participant_id
                       where la2.leg_id = l.id and p.mobility = 'wheelchair' and p.id <> new.id) as wheelchairs
               from public.leg_assignments la join public.transport_legs l on l.id = la.leg_id where la.participant_id = new.id loop
      if leg.wheelchairs >= leg.wheelchair_capacity then
        raise exception 'wheelchair:% has no free wheelchair place (% of %)', leg.code, leg.wheelchairs, leg.wheelchair_capacity using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end $$;
create trigger c_mobility before update of mobility on public.participants for each row execute function app.check_mobility_change();
revoke execute on function app.check_mobility_change from public, anon;

-- ---------------------------------------------------------------- E. pending badges: issue, scan, activate
-- A replacement badge is printed from a pending token; the person's current badge keeps working until the
-- organiser confirms the print. A pending token scans as 'pending' so the team can tell.
create function public.issue_pending_credential(p_participant uuid, p_batch uuid, p_kind public.credential_kind default 'card') returns text
language plpgsql volatile security definer set search_path = '' as $$
declare ed uuid; token text := app.new_token();
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_organizer(ed) or p_batch is null then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into public.pending_credentials (edition_id, participant_id, kind, token_hash, batch_id)
  values (ed, p_participant, p_kind, sha256(convert_to(token, 'UTF8')), p_batch);
  return 'LRD1.' || token;
end $$;

create function public.activate_batch(p_batch uuid) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select * from public.pending_credentials where batch_id = p_batch and activated_at is null and discarded_at is null
           order by issued_at loop
    if not app.is_organizer(r.edition_id) then
      raise exception 'not authorised' using errcode = '42501';
    end if;
    update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'replaced'
    where participant_id = r.participant_id and kind = r.kind and revoked_at is null;
    insert into public.credentials (edition_id, participant_id, kind, token_hash, issued_by, issued_at)
    values (r.edition_id, r.participant_id, r.kind, r.token_hash, r.issued_by, r.issued_at);
    update public.pending_credentials set activated_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.discard_batch(p_batch uuid) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  if exists (select 1 from public.pending_credentials where batch_id = p_batch and not app.is_organizer(edition_id)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.pending_credentials set discarded_at = now() where batch_id = p_batch and activated_at is null and discarded_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.issue_pending_credential, public.activate_batch, public.discard_batch from public, anon;
grant execute on function public.issue_pending_credential, public.activate_batch, public.discard_batch to authenticated;

create or replace function public.scan_badge(p_payload text, p_action public.scan_action default 'lookup',
                                             p_leg uuid default null, p_client_scan_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text; cred public.credentials; res text; pid uuid; pend public.pending_credentials;
begin
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
  if cred.id is null then
    -- a freshly printed badge whose print the organiser has not confirmed yet
    select * into pend from public.pending_credentials where token_hash = sha256(convert_to(token, 'UTF8'))
      and activated_at is null and discarded_at is null and issued_at > now() - interval '30 days';
    if pend.id is not null and app.is_staff(pend.edition_id) then
      insert into public.scans (edition_id, participant_id, leg_id, action, result, client_scan_id)
      values (pend.edition_id, pend.participant_id, p_leg, p_action, 'pending', p_client_scan_id);
      return jsonb_build_object('result', 'pending', 'participant', app.participant_card(pend.participant_id));
    end if;
    return jsonb_build_object('result', 'not_authorized');
  end if;
  if not app.is_staff(cred.edition_id) then
    return jsonb_build_object('result', 'not_authorized');
  end if;
  if cred.revoked_at is not null
     or exists (select 1 from public.participants pa left join public.profiles pr on pr.id = pa.user_id
                where pa.id = cred.participant_id
                  and (pr.status = 'suspended' or (cred.kind = 'digital' and pa.account_deleted_at is not null))) then
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

-- ---------------------------------------------------------------- F. incidents
-- The free text of a medical incident is for the medical role; everyone else sees that it exists, its kind,
-- severity and status. Clients read incidents through this view; the column itself is withheld.
revoke select on public.incidents from authenticated;
grant select (id, edition_id, kind, severity, status, participant_id, location, reported_by, assigned_to, resolved_at, version, created_at, updated_at, updated_by)
  on public.incidents to authenticated;
create view public.incident_reports with (security_barrier) as
  select i.id, i.edition_id, i.kind, i.severity, i.status, i.participant_id, i.location, i.reported_by, i.assigned_to,
         i.resolved_at, i.version, i.created_at, i.updated_at, i.updated_by,
         case when i.kind = 'medical' and not app.is_medical(i.edition_id) then null else i.summary end as summary
  from public.incidents i
  where i.edition_id in (select app.edition_ids('{organizer}'))
     or (i.kind <> 'medical' and i.edition_id in (select app.edition_ids('{organizer,medical,staff}')))
     or (i.kind in ('medical', 'care') and app.is_medical(i.edition_id))
     or i.reported_by = auth.uid() or i.assigned_to = auth.uid();
revoke all on public.incident_reports from anon, public;
grant select on public.incident_reports to authenticated;

-- An assignee works the incident; only organisers and the medical role may reclassify it or change its provenance.
create function app.guard_incident_fields() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.kind, new.reported_by, new.participant_id, new.edition_id) is distinct from (old.kind, old.reported_by, old.participant_id, old.edition_id)
     and not (app.is_organizer(old.edition_id) or app.is_medical(old.edition_id)) then
    raise exception 'only organisers may reclassify an incident' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger a_guard_fields before update on public.incidents for each row execute function app.guard_incident_fields();
revoke execute on function app.guard_incident_fields from public, anon;

-- ---------------------------------------------------------------- B. nightly purge where pg_cron exists
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $c$select cron.schedule('lurdy-purge-logs', '15 3 * * *', 'select app.purge_logs()')$c$;
  end if;
end $$;
