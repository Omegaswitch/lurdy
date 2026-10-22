-- app.edition_ids is the set form of app.has_role that most table policies use. The admin sign-in change
-- (20261022130000) updated has_role only; this brings the set form to the same rule: organiser and medical grants
-- need a password session with the second factor (whatever the event code), staff and assistant grants need a
-- valid event code. A code session (phone app) therefore never gets organiser or medical rights through any table.
create or replace function app.edition_ids(p_roles public.app_role[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.editions e
  where app.is_super_admin() and exists (select 1 from unnest(p_roles) r where r <> 'medical')
  union
  select pa.edition_id from public.role_grants g
    join public.participants pa on pa.id = g.participant_id
    join public.profiles p on p.id = pa.user_id
  where pa.user_id = auth.uid() and p.status = 'active' and g.role = any (p_roles)
    and case when g.role in ('staff', 'assistant') then app.staff_code_valid(pa.edition_id)
             else app.aal2() and app.password_session() end $$;
