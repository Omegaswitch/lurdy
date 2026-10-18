-- Foundations: schemas, enums, accounts, roles, authorisation helpers, version + audit triggers.
-- Rules are explained in docs/E-database.md and docs/F-security-privacy.md.

create schema if not exists app;      -- helper functions used by policies (not exposed by the API)
create schema if not exists medical;  -- health data (not exposed; reachable only via audited functions)
create schema if not exists audit;    -- change log (not exposed)
revoke all on schema app, medical, audit from public;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------- types
create type public.participant_category as enum ('staff', 'malade', 'assistant', 'pilgrim');
create type public.app_role as enum ('organizer', 'medical', 'staff', 'assistant');
create type public.edition_status as enum ('draft', 'active', 'archived');
create type public.mobility as enum ('walks', 'assisted', 'wheelchair');
create type public.leg_kind as enum ('flight', 'bus', 'truck', 'other');
create type public.leg_direction as enum ('outbound', 'return', 'local');
create type public.facility_kind as enum ('hotel', 'care', 'other');
create type public.care_kind as enum ('primary', 'backup', 'temporary');
create type public.incident_kind as enum ('operational', 'care', 'medical', 'missing_person', 'other');
create type public.incident_severity as enum ('low', 'normal', 'high', 'critical');
create type public.incident_status as enum ('open', 'in_progress', 'resolved');
create type public.scan_action as enum ('lookup', 'board', 'arrive', 'check_in');
create type public.credential_kind as enum ('card', 'digital');

-- ---------------------------------------------------------------- accounts and editions
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) <= 120),
  status text not null default 'active' check (status in ('active', 'suspended')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.editions (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year between 2000 and 2200),
  title text not null check (char_length(title) between 1 and 200),
  starts_on date not null,
  ends_on date not null,
  status public.edition_status not null default 'draft',
  timezone text not null default 'Europe/Paris',
  emergency_phone text check (char_length(emergency_phone) <= 40),
  badge_config jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (starts_on <= ends_on)
);
create unique index editions_one_active on public.editions ((true)) where status = 'active';

create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  unique (user_id, edition_id, role)
);

-- Accounts exist only by invitation (sign-ups are disabled in Auth settings); each gets a profile.
create function app.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.on_auth_user_created();

-- ---------------------------------------------------------------- authorisation helpers
-- MFA level of the current session (privileged grants only count at aal2).
create function app.aal2() returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' $$;

-- A TOTP verification happened within the last p_minutes (step-up for medical records).
create function app.mfa_fresh(p_minutes int) returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
    where e ->> 'method' = 'totp'
      and (e ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_minutes * 60) $$;

create function app.active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active') $$;

create function app.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active' and is_super_admin) $$;

-- Super admins pass every role check except 'medical': administration never implies medical access.
create function app.has_role(p_edition uuid, p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_super_admin() and exists (select 1 from unnest(p_roles) r where r <> 'medical'))
      or exists (
        select 1 from public.role_grants g join public.profiles p on p.id = g.user_id
        where g.user_id = auth.uid() and p.status = 'active' and g.edition_id = p_edition
          and g.role = any (p_roles)
          and (g.role in ('staff', 'assistant') or app.aal2())) $$;

create function app.is_organizer(p_edition uuid) returns boolean language sql stable set search_path = '' as $$
  select app.has_role(p_edition, '{organizer}') $$;
-- Staff = may see all participants' operational data and scan badges.
create function app.is_staff(p_edition uuid) returns boolean language sql stable set search_path = '' as $$
  select app.has_role(p_edition, '{organizer,medical,staff}') $$;
-- Team = any role in the edition (includes assistants).
create function app.is_team(p_edition uuid) returns boolean language sql stable set search_path = '' as $$
  select app.has_role(p_edition, '{organizer,medical,staff,assistant}') $$;
create function app.is_medical(p_edition uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() and exists (
    select 1 from public.role_grants g join public.profiles p on p.id = g.user_id
    where g.user_id = auth.uid() and p.status = 'active' and g.edition_id = p_edition and g.role = 'medical') $$;

-- ---------------------------------------------------------------- generic triggers
create function app.bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if to_jsonb(new) -> 'edition_id' is distinct from to_jsonb(old) -> 'edition_id' then
    raise exception 'edition_id cannot change' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create table audit.log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  edition_id uuid,
  table_name text not null,
  row_id uuid,
  op text not null,
  old jsonb,
  new jsonb
);
create index audit_log_edition_at on audit.log (edition_id, at desc);
create index audit_log_row on audit.log (row_id);

create function app.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit.log (actor, edition_id, table_name, row_id, op, old, new)
  values (auth.uid(),
          coalesce((r ->> 'edition_id')::uuid, case when tg_table_name = 'editions' then (r ->> 'id')::uuid end),
          tg_table_name, (r ->> 'id')::uuid, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- A participant id stored in any of the named columns must belong to the row's edition.
create function app.check_participant_refs() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(new); col text; pid uuid;
begin
  foreach col in array tg_argv loop
    pid := (r ->> col)::uuid;
    if pid is not null and not exists (
      select 1 from public.participants where id = pid and edition_id = (r ->> 'edition_id')::uuid) then
      raise exception '% refers to a participant of another edition', col using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;

create trigger z_audit after insert or update or delete on public.editions for each row execute function app.audit();
create trigger z_audit after insert or update or delete on public.role_grants for each row execute function app.audit();
create trigger z_audit after update on public.profiles for each row execute function app.audit();
create trigger version before update on public.editions for each row execute function app.bump_version();

-- ---------------------------------------------------------------- policies: accounts and editions
alter table public.profiles enable row level security;
alter table public.editions enable row level security;
alter table public.role_grants enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select app.is_super_admin())
  or exists (select 1 from public.role_grants g where g.user_id = (select auth.uid()) and g.role = 'organizer' and app.aal2()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select app.is_super_admin())) with check ((select app.is_super_admin()));
-- Own display name only; status and is_super_admin are protected by the column grant below.
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select app.active_user())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy editions_insert on public.editions for insert to authenticated with check ((select app.is_super_admin()));
create policy editions_update on public.editions for update to authenticated
  using (app.is_organizer(id)) with check (app.is_organizer(id));
create policy editions_delete on public.editions for delete to authenticated using ((select app.is_super_admin()));

create policy role_grants_select on public.role_grants for select to authenticated using (
  user_id = (select auth.uid()) or app.is_organizer(edition_id));
-- Organisers grant staff/assistant in their edition; only super admins grant organizer/medical.
create policy role_grants_insert on public.role_grants for insert to authenticated with check (
  (select app.is_super_admin()) or (app.is_organizer(edition_id) and role in ('staff', 'assistant')));
create policy role_grants_delete on public.role_grants for delete to authenticated using (
  (select app.is_super_admin()) or (app.is_organizer(edition_id) and role in ('staff', 'assistant')));
