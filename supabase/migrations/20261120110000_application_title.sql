-- Every form asks for a title before the name (Ing., MUDr., P., …, or one written in). It arrives with the
-- application and accepting puts it on the participant, as the organisers address people.
alter table public.applications add column title text check (char_length(title) <= 40);

create or replace function public.accept_application(p_application uuid, p_category public.participant_category,
  p_first_name text, p_last_name text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare a public.applications; pid uuid;
begin
  select * into a from public.applications where id = p_application for update;
  if a.id is null then raise exception 'application not found' using errcode = '42501'; end if;
  if a.status <> 'new' then raise exception 'application already decided' using errcode = '55000'; end if;
  insert into public.participants (edition_id, category, title, first_name, last_name, email, phone, language, gender, birth_year,
                                   previous_count, registered_on, travels_with, stays)
  values (a.edition_id, p_category, a.title, btrim(p_first_name), btrim(p_last_name), a.email, coalesce(a.phone, a.phone2), a.language,
          a.gender, extract(year from a.birth_date)::int,
          case when a.times ~ '^\s*\d{1,2}\s*$' then btrim(a.times)::int when a.times ~* '^\s*(ne|no|0|poprvé|first)' then 0 end,
          a.submitted_at::date, a.travels_with, case when p_category = 'malade' then 'A' else 'H' end)
  returning id into pid;
  if a.passport is not null or a.subsidy then
    insert into public.participant_private (participant_id, edition_id, passport, payment_note)
    values (pid, a.edition_id, a.passport, case when a.subsidy then 'Žádá o příspěvek na pouť' end);
  end if;
  update public.applications set status = 'accepted', participant_id = pid, decided_at = now(), decided_by = auth.uid()
  where id = a.id;
  return pid;
end $$;
revoke execute on function public.accept_application from public, anon;
grant execute on function public.accept_application to authenticated;

-- an erased person's application keeps no title either
create or replace function app.erase_application() returns trigger language plpgsql security definer set search_path = '' as $$
declare aid uuid;
begin
  update public.applications set full_name = '–', first_name = '–', last_name = '–', birth_date = null, email = null, phone = null,
    phone2 = null, address = null, emergency_name = null, emergency_phone = null, times = null, gender = null, passport = null,
    travels_with = null, title = null
  where participant_id = old.id returning id into aid;
  perform set_config('app.erasing_application', coalesce(aid::text, ''), true);
  return old;
end $$;
