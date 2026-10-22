-- The admin is signed into with e-mail + password + authenticator (TOTP), like the school websites. The simple
-- sign-in (attendee number + invitation code [+ event code]) stays for the phone app only: a session made that way
-- keeps the team rights it had (staff, assistant, with a valid event code) but never counts as organiser or medical.

-- The session was opened with a password (Supabase records each sign-in method in the token's amr claim; the
-- code sign-in goes through a one-time link, recorded as 'otp'/'magiclink').
create function app.password_session() returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e where e ->> 'method' = 'password') $$;
revoke execute on function app.password_session from public, anon;
grant execute on function app.password_session to authenticated;

-- Organiser and medical grants: password session + second factor, whatever the event code (organisers prepare the
-- pilgrimage all year). Staff and assistant grants: as before, only while the event code used at sign-in is valid.
create or replace function app.has_role(p_edition uuid, p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_super_admin() and exists (select 1 from unnest(p_roles) r where r <> 'medical'))
      or exists (
        select 1 from public.role_grants g
          join public.participants pa on pa.id = g.participant_id
          join public.profiles p on p.id = pa.user_id
        where pa.user_id = auth.uid() and p.status = 'active' and pa.edition_id = p_edition
          and g.role = any (p_roles)
          and case when g.role in ('staff', 'assistant') then app.staff_code_valid(p_edition)
                   else app.aal2() and app.password_session() end) $$;

-- For the one-time setup screen: does the signed-in user hold an organiser or medical grant at all? (Read through the
-- participant link, which a code session already has; the rights themselves still need the password session.)
create function public.my_admin_grant() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_grants g join public.participants pa on pa.id = g.participant_id
                 join public.profiles p on p.id = pa.user_id
                 where pa.user_id = auth.uid() and p.status = 'active' and g.role in ('organizer', 'medical')) $$;
revoke execute on function public.my_admin_grant from public, anon;
grant execute on function public.my_admin_grant to authenticated;
