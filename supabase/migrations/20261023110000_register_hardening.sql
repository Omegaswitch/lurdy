-- Hardening after the register's security review.
-- 1. GDPR erasure covers the register: a deleted person's passport, payments and the other register fields leave the
--    audit log too (the operational trail stays), including their application and their private row.
-- 2. The personal number (VarSym, the bank variable symbol) is assigned by the database and never changed through
--    the API: an organiser cannot pick one (which could exhaust the range and block every later insert) or renumber.

-- One list of the keys a deleted person must leave behind nowhere in the history.
create function app.personal_keys() returns text[] language sql immutable set search_path = '' as $$
  select array['access_code', 'login_secret', 'first_name', 'last_name', 'preferred_name', 'title', 'phone', 'email',
               'logistics_note', 'staff_note', 'photo_path', 'name', 'relation',
               -- the register and the application
               'passport', 'paid_czk', 'payment_note', 'travels_with', 'room_no', 'birth_year', 'gender',
               'full_name', 'birth_date', 'phone2', 'address', 'emergency_name', 'emergency_phone'] $$;
revoke execute on function app.personal_keys from public, anon;

create or replace function app.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
  personal constant text[] := app.personal_keys();
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'access_code' - 'login_secret' end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'access_code' - 'login_secret' end;
  pid uuid := coalesce(r ->> 'participant_id', case when tg_table_name = 'participants' then r ->> 'id' end)::uuid;
begin
  -- rows written while their person is being erased (the cascade after the participant's own delete) carry nothing
  -- personal from the start
  if pid is not null and tg_table_name <> 'participants' and not exists (select 1 from public.participants where id = pid) then
    o := o - personal; n := n - personal;
  end if;
  insert into audit.log (actor, edition_id, table_name, row_id, op, old, new)
  values (auth.uid(),
          coalesce((r ->> 'edition_id')::uuid, case when tg_table_name = 'editions' then (r ->> 'id')::uuid end),
          -- rows keyed by the participant (participant_private) are found again by that key
          tg_table_name, coalesce(r ->> 'id', r ->> 'participant_id')::uuid, tg_op, o, n);
  -- a deleted person leaves no name, contact, passport or payment in the history (GDPR erasure); the operational trail stays
  if tg_table_name = 'participants' and tg_op = 'DELETE' then
    update audit.log l set old = l.old - personal, new = l.new - personal
    where l.row_id = old.id or (l.old ->> 'participant_id') = old.id::text or (l.new ->> 'participant_id') = old.id::text
       -- their application, remembered by the before-delete trigger (the cascade has unlinked it by now)
       or l.row_id = nullif(current_setting('app.erasing_application', true), '')::uuid;
  end if;
  return null;
end $$;

-- Before the person goes: their application keeps nothing personal, and its id is kept for the audit scrub above.
create function app.erase_application() returns trigger language plpgsql security definer set search_path = '' as $$
declare aid uuid;
begin
  update public.applications set full_name = '–', first_name = '–', last_name = '–', birth_date = null, email = null, phone = null,
    phone2 = null, address = null, emergency_name = null, emergency_phone = null, times = null, gender = null, passport = null,
    travels_with = null
  where participant_id = old.id returning id into aid;
  perform set_config('app.erasing_application', coalesce(aid::text, ''), true);
  return old;
end $$;
revoke execute on function app.erase_application from public, anon;
create trigger y_erase_application before delete on public.participants for each row execute function app.erase_application();

-- VarSym: assigned by the database only. The guard is not security definer on purpose (as app.guard_participant_user):
-- inside it current_user is the role running the statement, so an API caller is refused while sign-in's and the
-- import's definer functions, and the backfill, pass.
create function app.guard_varsym() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.varsym is not null then
      raise exception 'the personal number is assigned automatically' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.varsym is distinct from old.varsym then
      raise exception 'the personal number cannot change' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function app.guard_varsym from public, anon;
-- a_ sorts before b_varsym, which then assigns the number
create trigger a_guard_varsym before insert or update of varsym on public.participants for each row execute function app.guard_varsym();
alter table public.participants alter column varsym set not null;

-- the register's private rows update live like everything else (Realtime applies the same row-level security)
alter publication supabase_realtime add table public.participant_private;
-- the registration date of people who were there before the register is the day they were added
update public.participants set registered_on = created_at::date where registered_on = current_date and created_at::date < current_date;
