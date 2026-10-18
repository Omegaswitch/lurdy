# Master roadmap — Lourdes pilgrimage platform

Planning set: [A Legacy workflows](A-legacy-workflow-analysis.md) · [B Requirements](B-product-requirements.md) · [C Prioritisation](C-feature-prioritization.md) · [D Architecture](D-architecture-decisions.md) · [E Database](E-database.md) · [F Security & privacy](F-security-privacy.md) · [G Navigation](G-navigation.md) · H this roadmap · [I Testing](I-testing.md) · [J Deployment](J-deployment.md) · live state: [STATUS](STATUS.md)

The order differs from the brief's suggestion in one place: the **medical authorisation model (MFA levels, role helpers, unexposed schema) is built in Phase 1**, and the medical *features* in Phase 6 — so no sensitive table ever exists without tested protection. The **end-to-end slice** (create participant → assign bus → badge → scan → move → scanner and app show the change) is pulled forward as Phase 2, because it proves the architecture.

Each phase ends with: tests green, docs updated, STATUS updated, commit.

---

## Phase 1 — Foundations
**Objective** A secure, tested database that every client can rely on.
**Features** schemas, enums, editions, profiles, role grants, authorisation helpers (incl. MFA level), version + audit triggers, all operational tables with RLS, capacity triggers.
**Dependencies** none.
**Tasks** migrations; local Postgres test harness with a Supabase `auth` shim; SQL tests per role; apply to `LurdyAPP`; generate TS types; Security Advisor check.
**Acceptance** every public table has RLS; each role sees exactly what F §3 says (tested); capacity cannot be exceeded under concurrent inserts; audit row on every write; organiser grant without MFA grants nothing.
**Tests** `supabase/tests/*.sql` via `supabase/tests/run.sh`.
**Risks** shim differs from hosted Supabase → mitigated by also running the suite against the hosted project inside a rolled-back transaction.
**DoD** suite green locally and on hosted; advisors clean; docs E/F match the SQL.

## Phase 2 — End-to-end slice (QR core)
**Objective** Prove the main operational loop on real infrastructure.
**Features** credentials (`issue`, `revoke`), `scan_badge` RPC, `my_pilgrimage` RPC; admin: sign-in with MFA, participants list/create/edit, legs + assignment + move, badge print; app: sign-in, scanner (camera + manual), My journey, My badge; Realtime refresh.
**Dependencies** Phase 1.
**Tasks** `platform/shared` (types, i18n, badge imposition), `platform/admin` (Vite), `platform/app` (Expo); E2E script.
**Acceptance** the scripted scenario passes: badge printed for Bus A → moved to Bus C → scan returns Bus C → participant's app shows Bus C without reload; scan-to-result measured.
**Tests** Vitest (domain), SQL (RPC), Playwright E2E (admin web + app web), scan latency script.
**Risks** camera scanning on web is browser-dependent → native app is primary scanner, web has manual entry.
**DoD** scenario green; latency recorded in STATUS.

## Phase 3 — Participant administration
Participant detail (emergency contacts, notes, mobility, photo), search/filter/bulk edit, accounts & invitations (Edge Function), role grants UI, CSV import with duplicate detection + reconciliation, CSV export (non-medical), edition create/duplicate/archive.
**Acceptance** import of a fictional 150-row CSV with 5 planted duplicates flags exactly those; duplicate edition copies structure and no people. **Tests** Vitest (CSV parse, dedupe), SQL (duplicate_edition), Playwright.

## Phase 4 — Logistics
Accommodation (facilities, rooms, occupancy, move), care assignments (coverage, conflicts, reassign), teams & duties (unfilled), drag-and-drop where it helps.
**Acceptance** overbooking prevented with a clear message; coverage view lists every malade without an active primary carer.

## Phase 5 — Printing
Badge layout editor (mm, A4 imposition, crop marks, offset, single/batch/reprint), manifests (flight, bus), room sheets, care roster, duty roster, alphabetical/category lists, programme, contact sheet — all stamped with edition + timestamp.
**Acceptance** badge PDF measured at exact mm in print preview; every template carries the stamp; no template contains medical fields.

## Phase 6 — Participant app completion
Home with next event, programme with day tabs and change markers, accommodation, Lourdes guide (places, texts, accessibility notes, text directions), contacts & help, settings (language, text size), offline cache with "as of".
**Acceptance** app usable with VoiceOver/TalkBack and at 200 % text; works offline after one sync.

## Phase 7 — Medical module
`medical.records`, step-up flow in admin and app, carer-shareable info, break-glass, medical incidents, access log report, retention purge job.
**Dependencies** Phase 1 helpers; DPIA in progress (organisational).
**Acceptance** tests prove: no direct select possible for any role; without fresh step-up → denied; every access logged; break-glass expires; purge deletes after 30 days.
**Risks** usability of MFA for volunteer doctors → clear enrolment guide.

## Phase 8 — Real-time operations
Announcements + acknowledgements, push notifications (Edge Function, Expo push, lock-screen-safe text), incidents workflow, conflict UI everywhere (version), live boarding dashboard, missing list, offline staff manifest + queued scans.

## Phase 9 — Production readiness
Accessibility audit (axe + manual checklist), full E2E, security review (RLS fuzz, advisors, dependency audit), performance (scan latency, 200 concurrent clients), backup/restore drill, deployment (staging → pilot → production), guides (admin, staff, participant onboarding), annual set-up runbook.

---

## Milestones
| Milestone | Contents | Target |
|---|---|---|
| M1 Pilot-ready core | Phases 1–5 | before registration for the next edition opens |
| M2 Operational | Phases 6–8 | dry run with staff ≥ 6 weeks before departure |
| M3 Production | Phase 9 + DPIA signed | ≥ 4 weeks before departure |
