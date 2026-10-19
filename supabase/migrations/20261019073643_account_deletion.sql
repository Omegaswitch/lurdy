-- In-app account deletion (App Store 5.1.1(v), Google Play account deletion policy).
-- The person deletes their sign-in account themselves: the Auth user goes (profile and links cascade), digital
-- codes on their phone stop working, and their personal code no longer signs anyone in. The registration itself
-- (name, bus, room) is the organisers' record of who travels; it stays until the organisers erase it under the
-- edition's retention rule, and the organisers see the deletion in the participant list. An organiser can give
-- the person access again by clearing account_deleted_at (e.g. they deleted by mistake).
alter table public.participants add column account_deleted_at timestamptz;

-- Called by the delete-account Edge Function with the caller's own session, just before the Auth user is deleted.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.credentials c set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'account deleted by the participant'
  from public.participants p
  where c.participant_id = p.id and p.user_id = auth.uid() and c.kind = 'digital' and c.revoked_at is null;
  update public.participants set account_deleted_at = now() where user_id = auth.uid();
end $$;
revoke execute on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;

create or replace function public.code_login_check(p_code text, p_staff_code text, p_ip text) returns jsonb
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
  insert into audit.login_attempts (ip, code, ok) values (p_ip, p_code, true);
  return jsonb_build_object('ok', true, 'participant_id', pa.id, 'user_id', pa.user_id, 'edition_id', pa.edition_id,
                            'staff_code_id', sc.id, 'team', is_team);
end $$;

