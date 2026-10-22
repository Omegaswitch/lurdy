-- Archive of past pilgrimages: who travelled (pilgrims), which sick pilgrims came (malades) and who served on the
-- team, year by year. Organisers fill it from their own formatted CSV lists (admin → Archiv). Contact details only:
-- there is no column for health information, and the import never reads one.
create type public.archive_list as enum ('pilgrim', 'malade', 'team');

create table public.archive_people (
  id uuid primary key default gen_random_uuid(),
  list public.archive_list not null,
  year int not null check (year between 1950 and 2200),
  last_name text not null check (char_length(last_name) between 1 and 120),
  first_name text not null check (char_length(first_name) between 1 and 120),
  title text check (char_length(title) <= 40),
  birth_date date check (birth_date between '1900-01-01' and '2100-12-31'),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  address text check (char_length(address) <= 300),
  parish text check (char_length(parish) <= 120),
  role text check (char_length(role) <= 120),
  note text check (char_length(note) <= 500),
  source_file text check (char_length(source_file) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
-- the index below folds accents with app.fold while a signed-in organiser writes, so they may run it (it only
-- lower-cases and strips accents); anonymous visitors still run no function
grant execute on function app.fold to authenticated;
-- the same person in the same list and year is archived once (accents and case ignored; the birth date tells namesakes apart)
create unique index archive_people_once on public.archive_people
  (list, year, app.fold(last_name), app.fold(first_name), coalesce(birth_date, '0001-01-01'::date));
create index archive_people_year on public.archive_people (list, year);

-- The archive spans years, so it is not tied to one edition: whoever is an organiser of some edition right now
-- (the same check as everywhere: organiser grant, valid pilgrimage code, second factor) or a super admin may use it.
-- Nobody else sees it.
create function app.is_any_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_super_admin() or exists (select 1 from public.editions e where app.is_organizer(e.id)) $$;
revoke execute on function app.is_any_organizer from public, anon;
grant execute on function app.is_any_organizer to authenticated;

alter table public.archive_people enable row level security;
create policy archive_people_select on public.archive_people for select to authenticated using ((select app.is_any_organizer()));
create policy archive_people_insert on public.archive_people for insert to authenticated with check ((select app.is_any_organizer()));
create policy archive_people_update on public.archive_people for update to authenticated
  using ((select app.is_any_organizer())) with check ((select app.is_any_organizer()));
create policy archive_people_delete on public.archive_people for delete to authenticated using ((select app.is_any_organizer()));
revoke all on public.archive_people from anon;

create trigger z_audit after insert or update or delete on public.archive_people for each row execute function app.audit();
