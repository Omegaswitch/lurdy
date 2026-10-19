-- Fingerprint of our schema objects; run locally and on the hosted project to prove they match.
select 'functions' k, md5(string_agg(pg_get_functiondef(p.oid), '' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))) v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app', 'public') and p.proname <> 'rls_auto_enable' -- Supabase's own
union all
select 'policies', md5(string_agg(schemaname || tablename || policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), '' order by tablename, policyname))
  from pg_policies where schemaname = 'public'
union all
select 'triggers', md5(string_agg(c.relname || t.tgname || pg_get_triggerdef(t.oid), '' order by c.relname, t.tgname))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
union all
select 'columns', md5(string_agg(table_name || column_name || data_type || coalesce(column_default, '') || is_nullable, '' order by table_name, ordinal_position))
  from information_schema.columns where table_schema in ('public', 'audit');
