-- Applications from the public website (lurdy.eu → Přihlášky): each form sent there also lands here, in the active
-- edition, for the organisers to accept into the participants or decline. Only what logistics needs: identity,
-- contact, emergency contact. Health answers, the ID-card number and attachments stay in the organisers' e-mail
-- (health data waits for the medical module). Rows arrive only through the Edge Function `application-intake`
-- (service role, shared secret held by the website); nobody inserts through the API.
create type public.application_form as enum ('pilgrim', 'malade', 'team');
create type public.application_status as enum ('new', 'accepted', 'declined');

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  form public.application_form not null,
  status public.application_status not null default 'new',
  full_name text not null check (char_length(full_name) between 1 and 200),
  first_name text not null check (char_length(first_name) between 1 and 120),
  last_name text not null check (char_length(last_name) between 1 and 120),
  birth_date date check (birth_date between '1900-01-01' and '2100-12-31'),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  phone2 text check (char_length(phone2) <= 40),
  address text check (char_length(address) <= 300),
  emergency_name text check (char_length(emergency_name) <= 200),
  emergency_phone text check (char_length(emergency_phone) <= 40),
  times text check (char_length(times) <= 200),
  language text not null default 'cs' check (language in ('cs', 'en', 'fr', 'it', 'de')),
  participant_id uuid references public.participants (id) on delete set null,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create index applications_edition on public.applications (edition_id, status, submitted_at);
create index applications_participant on public.applications (participant_id);

alter table public.applications enable row level security;
create policy applications_select on public.applications for select to authenticated
  using (edition_id in (select app.edition_ids('{organizer}')));
create policy applications_update on public.applications for update to authenticated
  using (edition_id in (select app.edition_ids('{organizer}'))) with check (edition_id in (select app.edition_ids('{organizer}')));
create policy applications_delete on public.applications for delete to authenticated
  using (edition_id in (select app.edition_ids('{organizer}')));
revoke all on public.applications from anon;
revoke insert on public.applications from authenticated;

create trigger z_audit after insert or update or delete on public.applications for each row execute function app.audit();

-- Accept: create the participant from the application (names as the organiser corrected them) and link it, in one
-- step. Runs as the organiser (security invoker), so the participants' and applications' rules apply as usual.
create function public.accept_application(p_application uuid, p_category public.participant_category,
  p_first_name text, p_last_name text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare a public.applications; pid uuid;
begin
  select * into a from public.applications where id = p_application for update;
  if a.id is null then raise exception 'application not found' using errcode = '42501'; end if;
  if a.status <> 'new' then raise exception 'application already decided' using errcode = '55000'; end if;
  insert into public.participants (edition_id, category, first_name, last_name, email, phone, language)
  values (a.edition_id, p_category, btrim(p_first_name), btrim(p_last_name), a.email, coalesce(a.phone, a.phone2), a.language)
  returning id into pid;
  update public.applications set status = 'accepted', participant_id = pid, decided_at = now(), decided_by = auth.uid()
  where id = a.id;
  return pid;
end $$;
revoke execute on function public.accept_application from public, anon;
grant execute on function public.accept_application to authenticated;

-- the inbox updates live when an application arrives (Realtime applies the same row-level security)
alter publication supabase_realtime add table public.applications;
