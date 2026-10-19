-- Hardening after the first full audit (docs/audits/2026-10-19-audit.md). Nothing here is destructive.
--
-- 1. Sign-in codes are credentials: hide `participants.access_code` from every API role; organisers read a
--    person's code through an RPC, the team's scanner searches through an RPC.
-- 2. Throttling: only real wrong guesses count, so a blocked address cannot lock other people's codes
--    and a venue NAT (hundreds of pilgrims behind one address) is not locked by its own mistypes.
-- 3. Audit log never stores codes; successful sign-ins are logged without the code.
-- 4. An organiser cannot re-point a registration at another account (and then suspend it).
-- 5. Lost-phone handling: `revoke_credential` revokes the digital code too; a suspended or deleted account's
--    badge scans as revoked; the phone can ask whether its stored code is still valid.
-- 6. Replay of a manual action must be the caller's own, for the same person.
-- 7. Default privileges: new functions are not executable by anon; `set_account_status` closed to anon.
-- 8. Indexes the scanner's history will need at ~20k scans.

-- ---------------------------------------------------------------- 7. privileges first
-- Supabase grants EXECUTE on every new public function to anon and authenticated by default; this project closes anon
-- everywhere, and tests/08_hardening.sql fails if a later migration forgets to (rule: every new function ends with
-- `revoke execute ... from public, anon`).
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema app from public, anon;
-- the column-privilege probe table used during the audit: out of the API, kept for the organisers to drop
alter table if exists public.zz_probe set schema app;

-- ---------------------------------------------------------------- 1. access codes out of the row
-- PostgREST refuses `select=*` once a column is withheld, so every client query on participants names its columns
-- (docs/E-database.md). A new column needs adding here.
revoke select on public.participants from authenticated;
grant select (id, edition_id, user_id, category, title, first_name, last_name, preferred_name, phone, email, language,
              mobility, logistics_note, staff_note, photo_path, account_deleted_at, version, created_at, updated_at, updated_by)
  on public.participants to authenticated;

-- Accent-insensitive, case-insensitive text for name search (no extension needed).
create function app.fold(p text) returns text language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(p, '')),
    'áäàâãåčçćďéěëèêíïìîňñóöòôõøřšśťúůüùûýÿžźżľĺŕ',
    'aaaaaacccdeeeeeiiiinnoooooorsstuuuuuyyzzzllr') $$;

-- One person's code, for the organiser's editor (organizer role, hence MFA).
create function public.participant_access_code(p_participant uuid) returns text
language sql stable security definer set search_path = '' as $$
  select pa.access_code from public.participants pa
  where pa.id = p_participant and app.is_organizer(pa.edition_id) $$;

-- Every code of an edition, for invitation mail-merge; each call is audited.
create function public.participant_access_codes(p_edition uuid) returns table (participant_id uuid, access_code text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.is_organizer(p_edition) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into audit.log (actor, edition_id, table_name, op) values (auth.uid(), p_edition, 'participants', 'EXPORT_CODES');
  return query select pa.id, pa.access_code from public.participants pa where pa.edition_id = p_edition;
end $$;

-- The scanner's manual search: name (accent-insensitive) or the exact 4-digit code. Returns no code.
create function public.find_participants(p_edition uuid, p_query text)
returns table (id uuid, first_name text, last_name text, category public.participant_category)
language sql stable security definer set search_path = '' as $$
  select pa.id, pa.first_name, pa.last_name, pa.category from public.participants pa
  where pa.edition_id = p_edition and app.is_staff(p_edition) and length(trim(p_query)) >= 2
    and (app.fold(pa.first_name || ' ' || pa.last_name) like '%' || app.fold(trim(p_query)) || '%'
      or app.fold(pa.last_name || ' ' || pa.first_name) like '%' || app.fold(trim(p_query)) || '%'
      or pa.access_code = trim(p_query))
  order by pa.last_name, pa.first_name limit 8 $$;

revoke execute on function public.participant_access_code, public.participant_access_codes, public.find_participants, app.fold from public, anon;
grant execute on function public.participant_access_code, public.participant_access_codes, public.find_participants to authenticated;

-- ---------------------------------------------------------------- 3. logs without codes
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit.log (actor, edition_id, table_name, row_id, op, old, new)
  values (auth.uid(),
          coalesce((r ->> 'edition_id')::uuid, case when tg_table_name = 'editions' then (r ->> 'id')::uuid end),
          tg_table_name, (r ->> 'id')::uuid, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'access_code' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'access_code' end);
  return null;
end $$;

-- ---------------------------------------------------------------- 2. throttling that cannot be turned against others
create or replace function public.code_login_check(p_code text, p_staff_code text, p_ip text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare pa public.participants; sc public.staff_codes; is_team boolean; fails_ip int; fails_code int;
begin
  -- Only wrong guesses count. A throttled answer is logged but never extends a block: otherwise one blocked
  -- address could lock any code with five requests, and a hotel's shared address would lock itself. The per-code
  -- limit is what slows guessing; the per-address limit is generous because hundreds of people share one.
  select count(*) filter (where ip = p_ip), count(*) filter (where code = p_code) into fails_ip, fails_code
  from audit.login_attempts where at > now() - interval '15 minutes' and reason = 'invalid' and (ip = p_ip or code = p_code);
  if fails_ip >= 30 or fails_code >= 5 then
    insert into audit.login_attempts (ip, code, ok, reason) values (p_ip, left(p_code, 4), false, 'throttled');
    return jsonb_build_object('ok', false, 'reason', 'throttled');
  end if;

  select p.* into pa from public.participants p join public.editions e on e.id = p.edition_id
  where p.access_code = p_code and e.status in ('draft', 'active') and p.account_deleted_at is null
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
  -- a successful sign-in is logged without the code: the code is a credential
  insert into audit.login_attempts (ip, ok) values (p_ip, true);
  return jsonb_build_object('ok', true, 'participant_id', pa.id, 'user_id', pa.user_id, 'edition_id', pa.edition_id,
                            'staff_code_id', sc.id, 'team', is_team);
end $$;

-- ---------------------------------------------------------------- 4. the account link is set by sign-in only
-- Organisers may edit a registration but not which account it belongs to (that would let them act as that person,
-- or suspend an organiser of another edition through set_account_status). Sign-in (security definer, so not the
-- 'authenticated' role) and Auth's own cascade (set null) still may.
-- Not security definer on purpose: inside it current_user is the role running the statement (authenticated for
-- an organiser's update, the owner for sign-in's definer function).
create function app.guard_participant_user() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id and current_user in ('authenticated', 'anon') and not app.is_super_admin() then
    raise exception 'the account link is set by sign-in' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger a_guard_user before update of user_id on public.participants for each row execute function app.guard_participant_user();
revoke execute on function app.guard_participant_user from public, anon;

create or replace function public.set_account_status(p_participant uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare pa public.participants;
begin
  select * into pa from public.participants where id = p_participant;
  if pa.id is null or pa.user_id is null or not app.is_organizer(pa.edition_id) or p_status not in ('active', 'suspended') then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = pa.user_id and is_super_admin) and not app.is_super_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  -- an account that also holds a role in another edition is only the super admin's to suspend
  if exists (select 1 from public.role_grants g join public.participants x on x.id = g.participant_id
             where x.user_id = pa.user_id and x.edition_id <> pa.edition_id) and not app.is_super_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.profiles set status = p_status where id = pa.user_id;
end $$;
revoke execute on function public.set_account_status from public, anon;

-- ---------------------------------------------------------------- 5. lost phone, suspended account
create or replace function public.revoke_credential(p_participant uuid, p_reason text default 'lost') returns void
language plpgsql security definer set search_path = '' as $$
declare ed uuid;
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_organizer(ed) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  -- every kind: a lost badge and a lost phone are reported the same way; the phone gets a new code by itself
  update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left(p_reason, 200)
  where participant_id = p_participant and revoked_at is null;
end $$;

create or replace function public.scan_badge(p_payload text, p_action public.scan_action default 'lookup',
                                             p_leg uuid default null, p_client_scan_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text; cred public.credentials; res text; pid uuid;
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
  if cred.id is null or not app.is_staff(cred.edition_id) then
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

-- ---------------------------------------------------------------- 6. replay is the caller's own
create or replace function public.staff_action(p_participant uuid, p_action public.scan_action,
                                               p_leg uuid default null, p_client_scan_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ed uuid; res text;
begin
  select edition_id into ed from public.participants where id = p_participant;
  if ed is null or not app.is_staff(ed) then
    return jsonb_build_object('result', 'not_authorized');
  end if;
  if p_client_scan_id is not null and exists (select 1 from public.scans where client_scan_id = p_client_scan_id) then
    select s.result into res from public.scans s
    where s.client_scan_id = p_client_scan_id and s.scanned_by = auth.uid() and s.participant_id = p_participant;
    if res is null then
      return jsonb_build_object('result', 'not_authorized');
    end if;
    return jsonb_build_object('result', res, 'replayed', true, 'participant', app.participant_card(p_participant));
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

-- A phone asks whether the code it stores is still the valid one (after a revocation, a reinstall elsewhere…).
create function public.my_digital_credential_valid(p_edition uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.credentials c join public.participants pa on pa.id = c.participant_id
    join public.editions e on e.id = pa.edition_id
    where pa.user_id = auth.uid() and app.active_user() and pa.account_deleted_at is null
      and c.kind = 'digital' and c.revoked_at is null
      and (pa.edition_id = p_edition or (p_edition is null and e.status = 'active'))) $$;
revoke execute on function public.my_digital_credential_valid from public, anon;
grant execute on function public.my_digital_credential_valid to authenticated;

create or replace function public.my_digital_credential(p_edition uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare pid uuid; ed uuid; token text := app.new_token();
begin
  select pa.id, pa.edition_id into pid, ed from public.participants pa join public.editions e on e.id = pa.edition_id
  where pa.user_id = auth.uid() and app.active_user() and pa.account_deleted_at is null
    and (pa.edition_id = p_edition or (p_edition is null and e.status = 'active'));
  if pid is null then
    raise exception 'no participation' using errcode = '42501';
  end if;
  -- a phone needs a new code a few times at most (new phone, revocation); more is a runaway client
  if (select count(*) from public.credentials where participant_id = pid and kind = 'digital' and issued_at > now() - interval '1 day') >= 10 then
    raise exception 'too many new codes today' using errcode = '54000';
  end if;
  update public.credentials set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'replaced'
  where participant_id = pid and kind = 'digital' and revoked_at is null;
  insert into public.credentials (edition_id, participant_id, kind, token_hash, issued_by)
  values (ed, pid, 'digital', sha256(convert_to(token, 'UTF8')), auth.uid());
  return 'LRD1.' || token;
end $$;

-- ---------------------------------------------------------------- 8. indexes for the scan history
create index scans_participant_at on public.scans (participant_id, scanned_at desc);
create index scans_credential on public.scans (credential_id);
create index participants_access_code_lookup on public.participants (access_code);
