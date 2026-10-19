-- Audit probe (2026-10-19): does PostgREST's `select=*` honour column-level privileges? Answer: no, it refuses the
-- request ("permission denied for table"), so withholding a column means naming columns in every query.
-- Kept so the local and hosted migration histories match; the hardening migration moves the table out of the API.
create table public.zz_probe (id int primary key, visible text, hidden text);
insert into public.zz_probe values (1, 'yes', 'secret');
alter table public.zz_probe enable row level security;
create policy zz_probe_read on public.zz_probe for select to authenticated using (true);
grant select (id, visible) on public.zz_probe to authenticated;
