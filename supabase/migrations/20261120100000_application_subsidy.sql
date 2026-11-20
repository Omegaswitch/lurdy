-- The sick pilgrims' form asks, just before sending, whether the pilgrim would like a contribution towards the
-- pilgrimage (Maltézský nadační fond LOURDES). The answer arrives with the application, shows in Přihlášky, and
-- accepting carries it into the register's payment note, so whoever handles payments sees it.
alter table public.applications add column subsidy boolean not null default false;

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
