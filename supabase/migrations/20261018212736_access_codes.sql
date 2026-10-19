-- Code-based sign-in, part 1 (organisers' decision, see docs/F-security-privacy.md §2):
--   * every participant has a random 4-digit access code, unique in the edition (also their attendee number);
--   * anyone holding a role (team) also needs the edition's 6-character event code, which has validity dates
--     (e.g. one code before the pilgrimage, another during it); when it expires, team rights lapse.

-- ---------------------------------------------------------------- access codes
create function app.random_access_code(p_edition uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare c text;
begin
  for i in 1..200 loop
    c := lpad(((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int & 2147483647) % 10000)::text, 4, '0');
    -- avoid easy guesses: 1111, 1234, 4321 and the like
    continue when c ~ '^(\d)\1{3}$' or '0123456789012' like '%' || c || '%' or '9876543210987' like '%' || c || '%';
    if not exists (select 1 from public.participants where edition_id = p_edition and access_code = c) then
      return c;
    end if;
  end loop;
  raise exception 'no free access code' using errcode = '54000';
end $$;

alter table public.participants add column access_code text check (access_code ~ '^[0-9]{4}$');
create unique index participants_access_code on public.participants (edition_id, access_code);

create function app.assign_access_code() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.access_code is null then
    new.access_code := app.random_access_code(new.edition_id);
  end if;
  return new;
end $$;
create trigger a_access_code before insert or update on public.participants for each row execute function app.assign_access_code();
update public.participants set access_code = null where access_code is null; -- fires the trigger for existing rows

-- ---------------------------------------------------------------- event (staff) codes
create table public.staff_codes (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  label text check (char_length(label) <= 80),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (edition_id, code),
  check (valid_until > valid_from)
);
alter table public.staff_codes enable row level security;
create policy staff_codes_organizer on public.staff_codes for all to authenticated
  using (app.is_organizer(edition_id)) with check (app.is_organizer(edition_id));
revoke all on public.staff_codes from anon;
create trigger z_audit after insert or update or delete on public.staff_codes for each row execute function app.audit();

-- The event code the account last signed in with.
alter table public.profiles add column staff_code_id uuid references public.staff_codes (id) on delete set null;

create function app.staff_code_valid(p_edition uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.staff_codes sc on sc.id = p.staff_code_id
    where p.id = auth.uid() and sc.edition_id = p_edition and now() >= sc.valid_from and now() < sc.valid_until) $$;
