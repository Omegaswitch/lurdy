-- Follow-up to the Supabase advisors after the remediation of 2026-10-19.
--
-- 1. The Security Advisor flags public.incident_reports as a SECURITY DEFINER view (a view runs as its owner by
--    default, so it would bypass the reader's row-level security). The view now runs as the reader
--    (security_invoker): the incidents policies and the column grant apply to the person asking. The one thing
--    the reader may not read directly — the free text of a medical incident — comes from a definer function in
--    the app schema that masks it unless the reader holds the medical role for that edition.
-- 2. The Performance Advisor lists foreign keys without a covering index; each gets one.

-- ---------------------------------------------------------------- 1. incident summary via the reader's rights
create or replace function app.incident_summary(p_incident uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when i.kind = 'medical' and not app.is_medical(i.edition_id) then null else i.summary end
  from public.incidents i
  where i.id = p_incident
    and (i.edition_id in (select app.edition_ids('{organizer}'::public.app_role[]))
      or (i.kind <> 'medical' and i.edition_id in (select app.edition_ids('{organizer,medical,staff}'::public.app_role[])))
      or (i.kind in ('medical', 'care') and app.is_medical(i.edition_id))
      or i.reported_by = auth.uid() or i.assigned_to = auth.uid())
$$;
revoke execute on function app.incident_summary(uuid) from public, anon;
grant execute on function app.incident_summary(uuid) to authenticated;

create or replace view public.incident_reports with (security_invoker = true) as
  select i.id, i.edition_id, i.kind, i.severity, i.status, i.participant_id, i.location, i.reported_by, i.assigned_to,
         i.resolved_at, i.version, i.created_at, i.updated_at, i.updated_by,
         app.incident_summary(i.id) as summary
  from public.incidents i;
alter view public.incident_reports reset (security_barrier);
revoke all on public.incident_reports from anon, public;
grant select on public.incident_reports to authenticated;

-- ---------------------------------------------------------------- 2. covering indexes for foreign keys
create index if not exists announcement_acks_user on public.announcement_acks (user_id);
create index if not exists duties_edition on public.duties (edition_id);
create index if not exists duties_lead on public.duties (lead_id);
create index if not exists duties_team on public.duties (team_id);
create index if not exists duty_assignments_edition on public.duty_assignments (edition_id);
create index if not exists emergency_contacts_edition on public.emergency_contacts (edition_id);
create index if not exists events_place on public.events (place_id);
create index if not exists guide_pages_edition on public.guide_pages (edition_id);
create index if not exists incidents_assigned_to on public.incidents (assigned_to);
create index if not exists incidents_participant on public.incidents (participant_id);
create index if not exists pending_credentials_edition on public.pending_credentials (edition_id);
create index if not exists places_edition on public.places (edition_id);
create index if not exists profiles_staff_code on public.profiles (staff_code_id);
create index if not exists rooms_responsible on public.rooms (responsible_id);
create index if not exists scans_leg on public.scans (leg_id);
create index if not exists team_members_edition on public.team_members (edition_id);
create index if not exists teams_leader on public.teams (leader_id);
create index if not exists transport_legs_facility on public.transport_legs (facility_id);
create index if not exists transport_legs_responsible on public.transport_legs (responsible_id);
