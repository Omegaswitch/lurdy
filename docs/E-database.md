# E. Database architecture

Postgres on Supabase. The migrations in `supabase/migrations/` are the source of truth; this document explains them.

## Schemas
| Schema | Exposed through the API? | Holds |
|---|---|---|
| `public` | yes (PostgREST + Realtime), **RLS on every table** | operational data, RPC functions |
| `app` | no | authorisation helper functions used by policies |
| `medical` | **no** | health records, break-glass sessions, medical access log |
| `audit` | no | change log of operational data |

Keys are `uuid` (`gen_random_uuid()`), never names. Every edition-scoped table carries `edition_id` so that policies are one indexed lookup.

## Entities

```
auth.users ─1:1─ profiles ─< role_grants >─ editions
                    │                          │
                    └──(user_id, optional)── participants ─< emergency_contacts
                                               │
     transport_legs ─< leg_assignments >───────┤
     facilities ─< rooms ─< room_assignments >─┤
     care_assignments (malade ↔ carer) >───────┤
     teams ─< team_members >───────────────────┤
     duties ─< duty_assignments >──────────────┤
     credentials (QR) ─< scans >───────────────┤
     incidents >───────────────────────────────┤
     medical.records (1:1, unexposed) ─────────┘
     events · contacts · announcements ─< announcement_acks · guide_pages · places
```

| Table | Purpose | Key constraints |
|---|---|---|
| `editions` | one pilgrimage year | at most one `active`; `starts_on <= ends_on`; badge layout in `badge_config` |
| `profiles` | account state for an `auth.users` row | `status` invited/active/suspended — suspension revokes access on the next request |
| `role_grants` | (user, edition, role) | roles: `organizer`, `medical`, `staff`, `assistant`; super admin is `profiles.is_super_admin` |
| `participants` | a person **in one edition** | category `staff/malade/assistant/pilgrim`; optional `user_id` (unique per edition); `mobility` walks/assisted/wheelchair |
| `emergency_contacts` | per participant | |
| `transport_legs` | a flight, bus or truck run | `kind`, `direction` outbound/return/local, `capacity`, `wheelchair_capacity`, `responsible_id`, destination `facility_id` |
| `leg_assignments` | participant on a leg | unique (leg, participant); trigger enforces capacity and wheelchair places under a row lock; `boarded_at/by`, `arrived_at/by` |
| `facilities`, `rooms` | hotel / care facility, rooms with `capacity`, `responsible_id` | unique (facility, number) |
| `room_assignments` | participant in a room | one room per participant; capacity trigger; `bed`, check-in/out times |
| `care_assignments` | carer ↔ malade | malade must be category `malade`; carer must not be; kind primary/backup/temporary; optional period; no duplicate pair+kind+start |
| `teams`, `team_members` | Team 1, Team Hotel, luggage team … | |
| `duties`, `duty_assignments` | time-boxed task, `needed` head count | `ends_at > starts_at` |
| `events` | programme item | `audiences` = categories (empty = everyone) |
| `contacts` | key contacts for an edition | `audiences`, `is_emergency` |
| `announcements`, `announcement_acks` | messages, critical with acknowledgement | |
| `guide_pages`, `places` | Lourdes guide, devotional texts, map points | may be edition-independent (`edition_id` null) |
| `credentials` | QR credential: `sha256(token)` only | one non-revoked credential per participant |
| `scans` | append-only scan/boarding log | `client_scan_id` unique → offline replays are idempotent |
| `incidents` | operational/care/medical/missing person | summary must not contain medical detail; medical detail goes to `medical.incident_notes` |
| `medical.records` | 1:1 with participant | reachable only via `public.medical_*` functions |
| `medical.break_glass` | time-limited emergency access | reason required, ≤ 30 min |
| `medical.access_log` | every medical read/write | append-only |
| `audit.log` | every insert/update/delete on operational tables | actor, before/after JSON |

## Integrity and concurrency
- **Optimistic locking**: `version` column, incremented by trigger `app.bump_version()`; clients filter on the version they read.
- **Capacity**: enforced in `BEFORE INSERT/UPDATE` triggers that lock the parent row (`FOR UPDATE`), so two organisers cannot both take the last seat.
- **Cross-edition safety**: triggers check that a leg/room/carer belongs to the same edition as the participant.
- **Deletion**: deleting a participant cascades to their assignments, credentials, contacts and medical record. Scans and audit rows keep the id but no personal fields (audit `old` JSON is purged by retention, see F §9).

## Functions (RPC)
| Function | Who | Does |
|---|---|---|
| `my_pilgrimage(edition?)` | any signed-in participant | one JSON with everything the participant app shows; cacheable offline |
| `scan_badge(payload, action, leg?, client_scan_id?)` | staff of the edition | resolves QR → live operational record; records lookup/board/arrive |
| `issue_credential(participant)` | organiser | revokes the previous credential, returns a new token **once** |
| `revoke_credential(participant, reason)` | organiser | revokes every credential of the person (printed badge and phone code: a lost phone is reported the same way as a lost badge) |
| `my_digital_credential(edition?)` / `my_digital_credential_valid(edition?)` | the participant | a new phone code (at most 10 a day) / whether the stored one is still the valid one |
| `participant_access_code(participant)` | organiser | the one sign-in code, for the editor; the column itself is not readable through the API |
| `participant_access_codes(edition)` | organiser | every code, for invitation mail-merge; each call writes an `EXPORT_CODES` audit row |
| `find_participants(edition, query)` | staff | the scanner's manual search: name (accent-insensitive) or exact code; returns names only |
| `delete_my_account()` | the participant | marks the registration, revokes the phone code; the Edge Function then deletes the Auth user |
| `duplicate_edition(source, …)` | super admin / organiser of source | copies structure (facilities, rooms, legs, teams, duties, events, contact *labels*, guide pages, badge layout) — never people, assignments, contacts' names/phones or medical data; dates shifted |
| `medical_record_get / medical_record_save` | medical role, MFA, fresh step-up | audited |
| `care_info_get(participant)` | active carer | only fields medical staff marked shareable; audited |
| `break_glass_open(participant, reason)` | staff/organiser with MFA | 30-minute read access, audited, flagged |
| `audit_entries(...)`, `medical_access_entries(...)` | organiser / super admin | read the logs |

## Migration strategy
- One SQL file per change in `supabase/migrations/`, timestamped, never edited after it is applied to a shared project.
- Every migration is first run against a local Postgres with a Supabase-compatible `auth` shim and the SQL test suite (`supabase/tests/run.sh`), then applied to the hosted project.
- Database types for TypeScript are generated from the hosted schema into `platform/shared/src/database.types.ts`.
- Two rules enforced by the test suite: every new function ends with `revoke execute … from public, anon` (Supabase grants `anon` by default), and `participants` queries name their columns — `access_code` is withheld by a column privilege, which makes PostgREST refuse `select=*` on that table. A new participants column must be added to the grant in `20261019130248_hardening.sql`'s successor.
- The migration history of the hosted project is the reference; two audit probe migrations (`zz_probe_*`) are kept locally so `supabase db push` sees the same history.
- Seed data (`supabase/seed.sql`) is entirely fictional and is only for local and development databases.
