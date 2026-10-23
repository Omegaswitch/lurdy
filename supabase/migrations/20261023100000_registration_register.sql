-- The organisers' registration register, as they have kept it for years in their Google Sheet (tab "Participants"):
-- one row per person with a running personal number (VarSym, also the bank payment's variable symbol), type
-- P / M / T, waiting list and cancelled ticks (never delete a row), role ticks, hotel or Accueil, the letter last sent
-- (w = waiting list, x = participation confirmed, o = payment confirmed) and whether the person confirmed it.
-- Passport number and payments sit in a separate table that only organisers read.

alter table public.participants
  add column varsym int check (varsym between 1 and 999999),
  add column waiting boolean not null default false,
  add column cancelled boolean not null default false,
  add column confirmed boolean not null default false,
  add column mail_sent text check (mail_sent in ('w', 'x', 'o')),
  add column gender text check (gender in ('M', 'F')),
  add column birth_year int check (birth_year between 1900 and 2100),
  add column previous_count int check (previous_count between 0 and 100),
  add column registered_on date default current_date,
  add column stays text not null default 'H' check (stays in ('H', 'A')),
  add column travels_with text check (char_length(travels_with) <= 200),
  add column room_no text check (char_length(room_no) <= 20),
  add column is_nurse boolean not null default false,
  add column is_doctor boolean not null default false,
  add column is_priest boolean not null default false,
  add column is_smom boolean not null default false,
  add column is_lead boolean not null default false,
  add column luggage_team boolean not null default false,     -- "H & 🧳": team at the hotel handling luggage (rides the hotel buses)
  add column plane_to_accueil boolean not null default false, -- "✈️ → A": team going from the plane to the Accueil with the sick
  add column truck_driver boolean not null default false,     -- "🚛"
  add column no_flight boolean not null default false;        -- "No ✈️": travels on their own (lower fee, no bus seat)
create unique index participants_varsym on public.participants (edition_id, varsym);

-- the next personal number in the edition (the sheet started at 400), unless one is given
create function app.assign_varsym() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.varsym is null then
    perform pg_advisory_xact_lock(hashtext('varsym:' || new.edition_id::text));
    select coalesce(max(varsym), 399) + 1 into new.varsym from public.participants where edition_id = new.edition_id;
  end if;
  return new;
end $$;
revoke execute on function app.assign_varsym from public, anon;
create trigger b_varsym before insert on public.participants for each row execute function app.assign_varsym();
update public.participants p set varsym = n.v
  from (select id, 399 + row_number() over (partition by edition_id order by created_at, id) v from public.participants) n
  where n.id = p.id;

-- the API reads named columns only (sign-in codes stay withheld); the register's columns join the list
grant select (varsym, waiting, cancelled, confirmed, mail_sent, gender, birth_year, previous_count, registered_on, stays,
              travels_with, room_no, is_nurse, is_doctor, is_priest, is_smom, is_lead, luggage_team, plane_to_accueil,
              truck_driver, no_flight)
  on public.participants to authenticated;

-- passport number (flight manifest) and payments: organisers of the edition only
create table public.participant_private (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,
  passport text check (char_length(passport) <= 40),
  paid_czk int not null default 0 check (paid_czk between 0 and 10000000),
  payment_note text check (char_length(payment_note) <= 300),
  updated_at timestamptz not null default now()
);
create index participant_private_edition on public.participant_private (edition_id);
alter table public.participant_private enable row level security;
create policy participant_private_organizer on public.participant_private for all to authenticated
  using (edition_id in (select app.edition_ids('{organizer}'))) with check (edition_id in (select app.edition_ids('{organizer}')));
revoke all on public.participant_private from anon;
create trigger z_audit after insert or update or delete on public.participant_private for each row execute function app.audit();
-- the row belongs to the participant's edition (no moving a payment to another year)
create function app.check_private_edition() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.participants where id = new.participant_id and edition_id = new.edition_id) then
    raise exception 'participant is not in this edition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function app.check_private_edition from public, anon;
create trigger a_edition before insert or update on public.participant_private for each row execute function app.check_private_edition();

-- the year's numbers from the sheet's Overview: capacities and fees (with and without the flight)
alter table public.editions
  add column cap_plane int check (cap_plane between 0 and 2000),
  add column cap_extra_hotel int check (cap_extra_hotel between 0 and 2000),
  add column cap_team int check (cap_team between 0 and 2000),
  add column cap_malades int check (cap_malades between 0 and 2000),
  add column caregiver_goal int check (caregiver_goal between 0 and 2000),
  add column fee_pilgrim int not null default 18000 check (fee_pilgrim between 0 and 1000000),
  add column fee_team int not null default 18000 check (fee_team between 0 and 1000000),
  add column fee_malade int not null default 18000 check (fee_malade between 0 and 1000000),
  add column fee_pilgrim_nf int not null default 10000 check (fee_pilgrim_nf between 0 and 1000000),
  add column fee_team_nf int not null default 10000 check (fee_team_nf between 0 and 1000000),
  add column fee_malade_nf int not null default 10000 check (fee_malade_nf between 0 and 1000000);

-- applications carry what the register needs: gender, the ID-card / passport number, who they travel with
alter table public.applications
  add column gender text check (gender in ('M', 'F')),
  add column passport text check (char_length(passport) <= 40),
  add column travels_with text check (char_length(travels_with) <= 200);

-- accepting fills the register: type, gender, birth year, earlier pilgrimages, registration date, travels with, passport
create or replace function public.accept_application(p_application uuid, p_category public.participant_category,
  p_first_name text, p_last_name text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare a public.applications; pid uuid;
begin
  select * into a from public.applications where id = p_application for update;
  if a.id is null then raise exception 'application not found' using errcode = '42501'; end if;
  if a.status <> 'new' then raise exception 'application already decided' using errcode = '55000'; end if;
  insert into public.participants (edition_id, category, first_name, last_name, email, phone, language, gender, birth_year,
                                   previous_count, registered_on, travels_with, stays)
  values (a.edition_id, p_category, btrim(p_first_name), btrim(p_last_name), a.email, coalesce(a.phone, a.phone2), a.language,
          a.gender, extract(year from a.birth_date)::int,
          case when a.times ~ '^\s*\d{1,2}\s*$' then btrim(a.times)::int when a.times ~* '^\s*(ne|no|0|poprvé|first)' then 0 end,
          a.submitted_at::date, a.travels_with, case when p_category = 'malade' then 'A' else 'H' end)
  returning id into pid;
  if a.passport is not null then
    insert into public.participant_private (participant_id, edition_id, passport) values (pid, a.edition_id, a.passport);
  end if;
  update public.applications set status = 'accepted', participant_id = pid, decided_at = now(), decided_by = auth.uid()
  where id = a.id;
  return pid;
end $$;
revoke execute on function public.accept_application from public, anon;
grant execute on function public.accept_application to authenticated;
