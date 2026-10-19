-- Audit probe, step 2: the table-level grant from Supabase's default privileges hid the effect; with it revoked,
-- `select=*` fails and `select=id,visible` works.
revoke all on public.zz_probe from anon, authenticated;
grant select (id, visible) on public.zz_probe to authenticated;
