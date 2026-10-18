-- Operational data: participants, transport, accommodation, care, teams, duties, programme,
-- contacts, announcements, guide, incidents. Policies follow the matrix in docs/F-security-privacy.md §3.

-- ---------------------------------------------------------------- participants
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  category public.participant_category not null,
  title text check (char_length(title) <= 40),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  preferred_name text check (char_length(preferred_name) <= 100),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  language text not null default 'cs' check (language ~ '^[a-z]{2}$'),
  mobility public.mobility not null default 'walks',
  logistics_note text check (char_length(logistics_note) <= 1000),
  staff_note text check (char_length(staff_note) <= 2000),
  photo_path text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index participants_user_per_edition on public.participants (edition_id, user_id) where user_id is not null;
create index participants_edition_name on public.participants (edition_id, lower(last_name), lower(first_name));
create index participants_user on public.participants (user_id);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  relation text check (char_length(relation) <= 100),
  phone text not null check (char_length(phone) between 3 and 40),
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index emergency_contacts_participant on public.emergency_contacts (participant_id);

-- ---------------------------------------------------------------- accommodation
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  short_label text check (char_length(short_label) <= 40),
  kind public.facility_kind not null default 'hotel',
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 40),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  colour text check (colour ~ '^#[0-9a-fA-F]{6}$'),
  note text check (char_length(note) <= 2000),
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  number text not null check (char_length(number) between 1 and 40),
  floor text check (char_length(floor) <= 40),
  zone text check (char_length(zone) <= 80),
  capacity int not null check (capacity between 0 and 100),
  responsible_id uuid references public.participants (id) on delete set null,
  note text check (char_length(note) <= 1000),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (facility_id, number)
);

create table public.room_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  participant_id uuid not null unique references public.participants (id) on delete cascade,
  bed text check (char_length(bed) <= 20),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index room_assignments_room on public.room_assignments (room_id);

-- ---------------------------------------------------------------- transport
create table public.transport_legs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  kind public.leg_kind not null,
  direction public.leg_direction not null,
  code text not null check (char_length(code) between 1 and 40),
  label text check (char_length(label) <= 200),
  origin text check (char_length(origin) <= 200),
  destination text check (char_length(destination) <= 200),
  departs_at timestamptz,
  arrives_at timestamptz,
  meeting_point text check (char_length(meeting_point) <= 300),
  meeting_at timestamptz,
  capacity int check (capacity between 0 and 1000),
  wheelchair_capacity int not null default 0 check (wheelchair_capacity >= 0),
  facility_id uuid references public.facilities (id) on delete set null,
  responsible_id uuid references public.participants (id) on delete set null,
  note text check (char_length(note) <= 2000),
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (arrives_at is null or departs_at is null or arrives_at >= departs_at)
);

create table public.leg_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  leg_id uuid not null references public.transport_legs (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  seat text check (char_length(seat) <= 20),
  boarded_at timestamptz,
  boarded_by uuid,
  arrived_at timestamptz,
  arrived_by uuid,
  note text check (char_length(note) <= 500),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (leg_id, participant_id)
);
create index leg_assignments_participant on public.leg_assignments (participant_id);

-- ---------------------------------------------------------------- care
create table public.care_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  malade_id uuid not null references public.participants (id) on delete cascade,
  carer_id uuid not null references public.participants (id) on delete cascade,
  kind public.care_kind not null default 'primary',
  starts_at timestamptz,
  ends_at timestamptz,
  note text check (char_length(note) <= 500),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (malade_id <> carer_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (kind <> 'temporary' or (starts_at is not null and ends_at is not null))
);
create unique index care_assignments_unique on public.care_assignments
  (malade_id, carer_id, kind, coalesce(starts_at, '-infinity'::timestamptz));
create index care_assignments_carer on public.care_assignments (carer_id);

-- ---------------------------------------------------------------- teams and duties
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  leader_id uuid references public.participants (id) on delete set null,
  note text check (char_length(note) <= 1000),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (edition_id, name)
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  unique (team_id, participant_id)
);
create index team_members_participant on public.team_members (participant_id);

create table public.duties (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text check (char_length(kind) <= 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (char_length(location) <= 200),
  team_id uuid references public.teams (id) on delete set null,
  lead_id uuid references public.participants (id) on delete set null,
  needed int not null default 1 check (needed between 0 and 200),
  note text check (char_length(note) <= 2000),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (ends_at > starts_at)
);

create table public.duty_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  duty_id uuid not null references public.duties (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  unique (duty_id, participant_id)
);
create index duty_assignments_participant on public.duty_assignments (participant_id);

-- ---------------------------------------------------------------- programme, contacts, communication, guide
create table public.events (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  title text not null check (char_length(title) between 1 and 200),
  location text check (char_length(location) <= 200),
  place_id uuid,
  description text check (char_length(description) <= 4000),
  audiences public.participant_category[] not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (ends_at is null or ends_at >= starts_at)
);
create index events_edition_start on public.events (edition_id, starts_at);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  name text check (char_length(name) <= 120),
  phone text check (char_length(phone) <= 40),
  is_emergency boolean not null default false,
  audiences public.participant_category[] not null default '{}',
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 4000),
  audiences public.participant_category[] not null default '{}',
  critical boolean not null default false,
  published_at timestamptz,
  created_by uuid default auth.uid(),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.announcement_acks (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  acked_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- Guide content and map points; edition_id null = shared by all editions.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  kind text check (char_length(kind) <= 40),
  description text check (char_length(description) <= 4000),
  accessibility text check (char_length(accessibility) <= 2000),
  directions text check (char_length(directions) <= 2000),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.events add foreign key (place_id) references public.places (id) on delete set null;

create table public.guide_pages (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  language text not null default 'cs' check (language ~ '^[a-z]{2}$'),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 100000),
  audiences public.participant_category[] not null default '{}',
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index guide_pages_slug on public.guide_pages (coalesce(edition_id, '00000000-0000-0000-0000-000000000000'::uuid), slug, language);

-- ---------------------------------------------------------------- incidents
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  kind public.incident_kind not null default 'operational',
  severity public.incident_severity not null default 'normal',
  status public.incident_status not null default 'open',
  participant_id uuid references public.participants (id) on delete set null,
  summary text not null check (char_length(summary) between 3 and 1000),
  location text check (char_length(location) <= 200),
  reported_by uuid not null default auth.uid(),
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index incidents_edition on public.incidents (edition_id, status);

-- ---------------------------------------------------------------- helpers that need the tables above
-- Participants (in any edition) that belong to the signed-in, active account.
create function app.my_participant_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pa.id from public.participants pa
  where pa.user_id = auth.uid() and app.active_user() $$;

create function app.is_member(p_edition uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_team(p_edition) or exists (
    select 1 from public.participants pa
    where pa.edition_id = p_edition and pa.user_id = auth.uid() and app.active_user()) $$;

create function app.my_category(p_edition uuid) returns public.participant_category
language sql stable security definer set search_path = '' as $$
  select pa.category from public.participants pa
  where pa.edition_id = p_edition and pa.user_id = auth.uid() and app.active_user() $$;

-- The signed-in account is a currently active carer of this participant.
create function app.is_carer_of(p_participant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.care_assignments ca join public.participants c on c.id = ca.carer_id
    where ca.malade_id = p_participant and c.user_id = auth.uid() and app.active_user()
      and (ca.starts_at is null or ca.starts_at <= now())
      and (ca.ends_at is null or ca.ends_at > now())) $$;

-- Audience filter for programme, contacts, announcements, guide: team sees everything.
create function app.sees_audience(p_edition uuid, p_audiences public.participant_category[]) returns boolean
language sql stable set search_path = '' as $$
  select app.is_team(p_edition)
      or (app.is_member(p_edition) and (cardinality(p_audiences) = 0 or app.my_category(p_edition) = any (p_audiences))) $$;


create policy editions_select on public.editions for select to authenticated using (
  (select app.is_super_admin()) or app.is_member(id));

-- ---------------------------------------------------------------- integrity triggers
-- Child rows take edition_id from their parent (tg_argv: parent table, foreign key column).
create function app.inherit_edition() returns trigger language plpgsql security definer set search_path = '' as $$
declare ed uuid;
begin
  execute format('select edition_id from public.%I where id = $1', tg_argv[0])
    into ed using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if ed is null then
    raise exception '% not found', tg_argv[1] using errcode = '23503';
  end if;
  new.edition_id := ed;
  return new;
end $$;

create trigger a_inherit before insert or update on public.emergency_contacts for each row execute function app.inherit_edition('participants', 'participant_id');
create trigger a_inherit before insert or update on public.rooms for each row execute function app.inherit_edition('facilities', 'facility_id');
create trigger a_inherit before insert or update on public.room_assignments for each row execute function app.inherit_edition('rooms', 'room_id');
create trigger a_inherit before insert or update on public.leg_assignments for each row execute function app.inherit_edition('transport_legs', 'leg_id');
create trigger a_inherit before insert or update on public.team_members for each row execute function app.inherit_edition('teams', 'team_id');
create trigger a_inherit before insert or update on public.duty_assignments for each row execute function app.inherit_edition('duties', 'duty_id');
create trigger a_inherit before insert or update on public.care_assignments for each row execute function app.inherit_edition('participants', 'malade_id');

create trigger b_refs before insert or update on public.rooms for each row execute function app.check_participant_refs('responsible_id');
create trigger b_refs before insert or update on public.room_assignments for each row execute function app.check_participant_refs('participant_id');
create trigger b_refs before insert or update on public.transport_legs for each row execute function app.check_participant_refs('responsible_id');
create trigger b_refs before insert or update on public.leg_assignments for each row execute function app.check_participant_refs('participant_id');
create trigger b_refs before insert or update on public.care_assignments for each row execute function app.check_participant_refs('malade_id', 'carer_id');
create trigger b_refs before insert or update on public.teams for each row execute function app.check_participant_refs('leader_id');
create trigger b_refs before insert or update on public.team_members for each row execute function app.check_participant_refs('participant_id');
create trigger b_refs before insert or update on public.duties for each row execute function app.check_participant_refs('lead_id');
create trigger b_refs before insert or update on public.duty_assignments for each row execute function app.check_participant_refs('participant_id');
create trigger b_refs before insert or update on public.incidents for each row execute function app.check_participant_refs('participant_id');

create function app.check_leg_facility() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.facility_id is not null and not exists (
    select 1 from public.facilities where id = new.facility_id and edition_id = new.edition_id) then
    raise exception 'facility belongs to another edition' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger b_facility before insert or update on public.transport_legs for each row execute function app.check_leg_facility();

-- Capacity checks lock the parent row so two simultaneous assignments cannot take the same last place.
create function app.check_leg_capacity() returns trigger language plpgsql security definer set search_path = '' as $$
declare leg record; taken int; wheelchairs int; is_wheelchair boolean;
begin
  if tg_op = 'UPDATE' and new.leg_id = old.leg_id and new.participant_id = old.participant_id then
    return new;
  end if;
  select capacity, wheelchair_capacity, code into leg from public.transport_legs where id = new.leg_id for update;
  select count(*) into taken from public.leg_assignments where leg_id = new.leg_id and id <> new.id;
  if leg.capacity is not null and taken >= leg.capacity then
    raise exception 'capacity:% is full (% of %)', leg.code, taken, leg.capacity using errcode = '23514';
  end if;
  select mobility = 'wheelchair' into is_wheelchair from public.participants where id = new.participant_id;
  if is_wheelchair then
    select count(*) into wheelchairs from public.leg_assignments la join public.participants p on p.id = la.participant_id
    where la.leg_id = new.leg_id and la.id <> new.id and p.mobility = 'wheelchair';
    if wheelchairs >= leg.wheelchair_capacity then
      raise exception 'wheelchair:% has no free wheelchair place (% of %)', leg.code, wheelchairs, leg.wheelchair_capacity using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger c_capacity before insert or update on public.leg_assignments for each row execute function app.check_leg_capacity();

create function app.check_room_capacity() returns trigger language plpgsql security definer set search_path = '' as $$
declare cap int; num text; taken int;
begin
  if tg_op = 'UPDATE' and new.room_id = old.room_id then
    return new;
  end if;
  select capacity, number into cap, num from public.rooms where id = new.room_id for update;
  select count(*) into taken from public.room_assignments where room_id = new.room_id and id <> new.id;
  if taken >= cap then
    raise exception 'capacity:room % is full (% of %)', num, taken, cap using errcode = '23514';
  end if;
  return new;
end $$;
create trigger c_capacity before insert or update on public.room_assignments for each row execute function app.check_room_capacity();

create function app.check_care_roles() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.participants where id = new.malade_id and category = 'malade') then
    raise exception 'care: the cared-for person must be in category malade' using errcode = '23514';
  end if;
  if exists (select 1 from public.participants where id = new.carer_id and category = 'malade') then
    raise exception 'care: a malade cannot be a carer' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger c_roles before insert or update on public.care_assignments for each row execute function app.check_care_roles();

-- Version + audit + RLS on every operational table.
do $$
declare t text;
begin
  foreach t in array array['participants', 'emergency_contacts', 'facilities', 'rooms', 'room_assignments',
    'transport_legs', 'leg_assignments', 'care_assignments', 'teams', 'duties', 'events', 'contacts',
    'announcements', 'places', 'guide_pages', 'incidents'] loop
    execute format('create trigger version before update on public.%I for each row execute function app.bump_version()', t);
  end loop;
  foreach t in array array['participants', 'emergency_contacts', 'facilities', 'rooms', 'room_assignments',
    'transport_legs', 'leg_assignments', 'care_assignments', 'teams', 'team_members', 'duties', 'duty_assignments',
    'events', 'contacts', 'announcements', 'announcement_acks', 'places', 'guide_pages', 'incidents'] loop
    execute format('create trigger z_audit after insert or update or delete on public.%I for each row execute function app.audit()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- Organisers write everything operational in their edition.
  foreach t in array array['participants', 'emergency_contacts', 'facilities', 'rooms', 'room_assignments',
    'transport_legs', 'leg_assignments', 'care_assignments', 'teams', 'team_members', 'duties', 'duty_assignments',
    'events', 'contacts', 'announcements'] loop
    execute format('create policy %I on public.%I for all to authenticated using (app.is_organizer(edition_id)) with check (app.is_organizer(edition_id))', t || '_organizer', t);
  end loop;
  -- Team (all roles) reads the working structure.
  foreach t in array array['teams', 'team_members', 'duties', 'duty_assignments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.is_team(edition_id))', t || '_team_read', t);
  end loop;
  -- Audience-filtered content.
  foreach t in array array['events', 'contacts'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.sees_audience(edition_id, audiences))', t || '_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- read policies
create policy participants_read on public.participants for select to authenticated using (
  app.has_role(edition_id, '{organizer,medical,staff}')
  or (user_id = (select auth.uid()) and (select app.active_user()))
  or app.is_carer_of(id));

create policy emergency_contacts_read on public.emergency_contacts for select to authenticated using (
  app.is_staff(edition_id) or participant_id in (select app.my_participant_ids()) or app.is_carer_of(participant_id));

create policy facilities_read on public.facilities for select to authenticated using (app.is_member(edition_id));

create policy rooms_read on public.rooms for select to authenticated using (
  app.is_team(edition_id) or exists (
    select 1 from public.room_assignments ra where ra.room_id = rooms.id
      and (ra.participant_id in (select app.my_participant_ids()) or app.is_carer_of(ra.participant_id))));

create policy room_assignments_read on public.room_assignments for select to authenticated using (
  app.is_team(edition_id) or participant_id in (select app.my_participant_ids()) or app.is_carer_of(participant_id));

create policy transport_legs_read on public.transport_legs for select to authenticated using (
  app.is_team(edition_id) or exists (
    select 1 from public.leg_assignments la where la.leg_id = transport_legs.id
      and (la.participant_id in (select app.my_participant_ids()) or app.is_carer_of(la.participant_id))));

create policy leg_assignments_read on public.leg_assignments for select to authenticated using (
  app.is_team(edition_id) or participant_id in (select app.my_participant_ids()) or app.is_carer_of(participant_id));

create policy care_assignments_read on public.care_assignments for select to authenticated using (
  app.is_staff(edition_id) or malade_id in (select app.my_participant_ids()) or carer_id in (select app.my_participant_ids()));

create policy announcements_read on public.announcements for select to authenticated using (
  app.is_organizer(edition_id) or (published_at <= now() and app.sees_audience(edition_id, audiences)));

create policy announcement_acks_read on public.announcement_acks for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.announcements a where a.id = announcement_id and app.is_organizer(a.edition_id)));
create policy announcement_acks_insert on public.announcement_acks for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.announcements a where a.id = announcement_id));

create policy places_read on public.places for select to authenticated using (
  (edition_id is null and (select app.active_user())) or app.is_member(edition_id));
create policy places_write on public.places for all to authenticated
  using (case when edition_id is null then (select app.is_super_admin()) else app.is_organizer(edition_id) end)
  with check (case when edition_id is null then (select app.is_super_admin()) else app.is_organizer(edition_id) end);

create policy guide_pages_read on public.guide_pages for select to authenticated using (
  (edition_id is null and (select app.active_user())) or app.sees_audience(edition_id, audiences));
create policy guide_pages_write on public.guide_pages for all to authenticated
  using (case when edition_id is null then (select app.is_super_admin()) else app.is_organizer(edition_id) end)
  with check (case when edition_id is null then (select app.is_super_admin()) else app.is_organizer(edition_id) end);

-- Medical incidents are visible to medical staff and organisers only (organisers see the non-medical summary).
create policy incidents_read on public.incidents for select to authenticated using (
  app.is_organizer(edition_id)
  or (kind <> 'medical' and app.is_staff(edition_id))
  or (kind in ('medical', 'care') and app.is_medical(edition_id))
  or reported_by = (select auth.uid()) or assigned_to = (select auth.uid()));
create policy incidents_insert on public.incidents for insert to authenticated with check (
  app.is_team(edition_id) and reported_by = (select auth.uid()));
create policy incidents_update on public.incidents for update to authenticated
  using (app.is_organizer(edition_id) or (kind in ('medical', 'care') and app.is_medical(edition_id)) or assigned_to = (select auth.uid()))
  with check (app.is_organizer(edition_id) or (kind in ('medical', 'care') and app.is_medical(edition_id)) or assigned_to = (select auth.uid()));

-- Anonymous visitors get nothing from any table.
revoke all on all tables in schema public from anon;

alter publication supabase_realtime add table
  public.editions, public.participants, public.transport_legs, public.leg_assignments, public.facilities,
  public.rooms, public.room_assignments, public.care_assignments, public.teams, public.team_members,
  public.duties, public.duty_assignments, public.events, public.contacts, public.announcements, public.incidents;
