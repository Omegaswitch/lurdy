-- The super admin (master access) follows the admin rule too: a password session with the second factor. A code
-- session (phone app) never counts as super admin, even if that person is also a participant.
create or replace function app.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() and app.password_session() and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active' and is_super_admin) $$;
