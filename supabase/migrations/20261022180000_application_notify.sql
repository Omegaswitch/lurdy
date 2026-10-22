-- Who is told by e-mail that a new application has arrived on the website (admin → Přihlášky → Upozornění).
-- A short list of addresses chosen by a super admin (e.g. one coordinator or a shared mailbox), not every admin.
-- The intake function reads it with the service role and returns it to the website, which sends the notice.
create table public.application_notify (
  email text primary key check (char_length(email) <= 200 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and email = lower(email)),
  added_at timestamptz not null default now(),
  added_by uuid default auth.uid()
);
alter table public.application_notify enable row level security;
create policy application_notify_select on public.application_notify for select to authenticated using ((select app.is_super_admin()));
create policy application_notify_insert on public.application_notify for insert to authenticated with check ((select app.is_super_admin()));
create policy application_notify_delete on public.application_notify for delete to authenticated using ((select app.is_super_admin()));
revoke all on public.application_notify from anon;
revoke update on public.application_notify from authenticated;
create trigger z_audit after insert or update or delete on public.application_notify for each row execute function app.audit();
