# Graph Report - lurdy  (2026-11-02)

## Corpus Check
- 187 files · ~151,805 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: .woff2 24, (none) 5, .example 2)

## Summary
- 1472 nodes · 3350 edges · 96 communities (62 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f47690f7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- steps
- ui.tsx
- build.py
- 20261018211334_operations.sql
- admin/package.json
- helpers.ts
- Accommodation.tsx
- 20261018211208_foundation.sql
- expo
- app/package.json
- dependencies
- types.ts
- prihlaska.js
- public.profiles
- Observed workflows and their digital replacement
- D. Architecture decision record
- ROADMAP.md
- shared/package.json
- F. Security and privacy architecture
- Master roadmap — Lourdes pilgrimage platform
- compilerOptions
- vercel.json
- scripts
- Audit of the whole platform — 2026-10-19
- run.sh
- J. Deployment strategy
- admin/tsconfig.json
- LourdesMap.tsx
- i18n.ts
- C. Feature prioritisation
- Mobile / web app (`platform/app`, Expo)
- Project status
- Aplikace pro tým – skenování, nástupy, služba
- platform/package.json
- B. Product requirements
- E. Database architecture
- STATUS.md
- AGENTS.md
- devDependencies
- Archive.tsx
- Aplikace Pouť do Lurd – návod pro poutníky a nemocné
- expo-crypto
- app/tsconfig.json
- expo-font@~58.0.8
- @expo-google-fonts/asap
- shared/tsconfig.json
- 20261023110000_register_hardening.sql
- code-login/index.ts
- 04_concurrency.sh
- 06_seed_dev.sh
- css.d.ts
- assets/README.md
- public.editions
- 03_scan.sql
- 05_code_login.sql
- site.js
- 20261019133339_remediation.sql
- expo-keep-awake
- 07_account_deletion.sql
- 20261019150000_advisor_followup.sql
- public.participants
- src/index.ts
- Login.tsx
- @expo/metro-runtime@~58.0.14
- t
- t
- Module
- Badges.tsx
- admin/vercel.json
- 08_hardening.sql
- 20261019123937_zz_probe_column_privileges.sql
- THIRD-PARTY.md
- expo-splash-screen@~58.0.10
- 20261022120000_archive.sql
- expo-status-bar
- 09_remediation.sql
- react@19.3.0
- react-native-safe-area-context
- 20261022180000_application_notify.sql
- friendlyError
- pnpm-workspace.yaml
- Register.tsx
- 20261023100000_registration_register.sql

## God Nodes (most connected - your core abstractions)
1. `friendlyError()` - 75 edges
2. `public.participants` - 75 edges
3. `t()` - 63 edges
4. `Notice()` - 56 edges
5. `Module()` - 50 edges
6. `useReady()` - 43 edges
7. `public.editions` - 40 edges
8. `T()` - 37 edges
9. `Icon()` - 35 edges
10. `useStore()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Medium` --references--> `DuplicateIndex`  [INFERRED]
  docs/audits/2026-10-19-audit.md → platform/shared/src/csv.ts
- `Entities` --references--> `active()`  [INFERRED]
  docs/E-database.md → platform/shared/src/register.ts
- `7. Changes made` --references--> `encryptedStorage()`  [INFERRED]
  docs/audits/2026-10-19-remediation.md → platform/shared/src/encryptedStorage.ts
- `remove()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Archive.tsx → platform/admin/src/errors.ts
- `run()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Archive.tsx → platform/admin/src/errors.ts

## Import Cycles
- None detected.

## Communities (96 total, 34 thin omitted)

### Community 0 - "steps"
Cohesion: 0.10
Nodes (24): runs-on, steps, jobs, database, platform, website, name, on (+16 more)

### Community 1 - "ui.tsx"
Cohesion: 0.07
Nodes (84): Account(), Badge(), useMaxBrightness(), Duty(), MyLeg, call(), Help(), Home() (+76 more)

### Community 2 - "build.py"
Cohesion: 0.06
Nodes (40): build(), contact_card(), crumbs_html(), date_span(), downloads(), facts(), faq_list(), field_html() (+32 more)

### Community 3 - "20261018211334_operations.sql"
Cohesion: 0.08
Nodes (35): a_inherit, app.check_care_roles(), app.check_leg_capacity(), app.check_leg_facility(), app.check_room_capacity(), app.is_carer_of(), app.is_member(), app.my_category() (+27 more)

### Community 4 - "admin/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @lurdy/shared@workspace:*, qrcode@1.5.4, react@19.3.0, react-dom@19.3.0, read-excel-file@9.3.10, @supabase/supabase-js@2.118.0, write-excel-file@4.1.1 (+31 more)

### Community 5 - "helpers.ts"
Cohesion: 0.07
Nodes (36): devDependencies, @axe-core/playwright@4.11.0, @playwright/test@1.56.1, read-excel-file@9.3.10, @supabase/supabase-js@2.118.0, typescript@5.9.3, write-excel-file@4.1.1, read-excel-file (+28 more)

### Community 6 - "Accommodation.tsx"
Cohesion: 0.19
Nodes (12): fullName(), Affecting, Facility, fold(), kindLabel, kinds, Occupant, Person (+4 more)

### Community 7 - "20261018211208_foundation.sql"
Cohesion: 0.09
Nodes (12): app.active_user(), app.check_participant_refs(), app.is_super_admin(), app.on_auth_user_created(), audit.log, audit_log_edition_at, audit_log_row, editions_one_active (+4 more)

### Community 8 - "expo"
Cohesion: 0.06
Nodes (34): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, allowBackup, blockedPermissions, package (+26 more)

### Community 9 - "app/package.json"
Cohesion: 0.13
Nodes (14): aes-js@3.1.2, expo-brightness@~58.0.2, expo-constants@~58.0.12, expo-location@~58.0.17, react-native-screens@~4.30.0, aes-js, main, name (+6 more)

### Community 10 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, expo-camera@~58.0.10, expo-linking@~58.0.13, expo-router@~58.0.24, expo-secure-store@~58.0.2, @lurdy/shared@workspace:*, react-dom@19.3.0, react-native@0.88.0 (+11 more)

### Community 11 - "types.ts"
Cohesion: 0.11
Nodes (16): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+8 more)

### Community 12 - "prihlaska.js"
Cohesion: 0.06
Nodes (21): button(), esc(), fs, logo(), logoWidth(), path, png(), rows() (+13 more)

### Community 13 - "public.profiles"
Cohesion: 0.10
Nodes (27): app.has_role(), app.is_medical(), public.profiles, public.role_grants, a_access_code, app.staff_code_valid(), public.staff_codes, z_audit (+19 more)

### Community 14 - "Observed workflows and their digital replacement"
Cohesion: 0.13
Nodes (15): 10. Night shifts, meal service, cleaning (doc 2), 11. Team meals and vouchers (doc 2), 1. Programme and daily schedule (docs 1, 2), 2. Different instructions for pilgrims and team (docs 1 vs 2), 3. Team roster and responsibilities (docs 2, 3), 4. Sick person ↔ carer assignment (docs 5, 6, 2), 5. Accommodation and rooms (docs 1, 2, 5), 6. Airport and bus coordination (doc 2) (+7 more)

### Community 15 - "D. Architecture decision record"
Cohesion: 0.12
Nodes (16): ADR-10 Brand — accepted, ADR-11 Sign-in by personal code — accepted (organisers' decision), ADR-12 Field app is big-button, edits happen on the web — accepted (organisers' decision), ADR-13 Map: Leaflet + OpenStreetMap as an Expo DOM component — accepted, ADR-1 Backend: Supabase (mandated) — accepted, ADR-2 Authorisation lives in the database — accepted, ADR-3 Medical data in a separate, unexposed schema — accepted, ADR-4 Two clients, one shared package — accepted (+8 more)

### Community 17 - "shared/package.json"
Cohesion: 0.13
Nodes (18): dependencies, aes-js@3.1.2, devDependencies, @types/aes-js@3.1.4, typescript@5.9.3, vitest@^5.0.5, aes-js, typescript (+10 more)

### Community 18 - "F. Security and privacy architecture"
Cohesion: 0.17
Nodes (12): 10. GDPR — what needs organisational decisions, 11. Platform hardening checklist (before real data), 1. Threat model (what we protect against), 2. Authentication, 3. Authorisation model, 4. Medical data segregation, 5. Break-glass, 6. Data minimisation decisions (+4 more)

### Community 19 - "Master roadmap — Lourdes pilgrimage platform"
Cohesion: 0.18
Nodes (11): Master roadmap — Lourdes pilgrimage platform, Milestones, Phase 1 — Foundations, Phase 2 — End-to-end slice (QR core), Phase 3 — Participant administration, Phase 4 — Logistics, Phase 5 — Printing, Phase 6 — Participant app completion (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, isolatedModules, module, moduleResolution, noEmit, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck (+2 more)

### Community 21 - "vercel.json"
Cohesion: 0.15
Nodes (12): includeFiles, buildCommand, cleanUrls, framework, functions, api/prihlaska.js, headers, installCommand (+4 more)

### Community 22 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, android, export:web, ios, lint, start, test, typecheck (+1 more)

### Community 23 - "Audit of the whole platform — 2026-10-19"
Cohesion: 0.17
Nodes (12): 1. Findings by severity, 2. Issues verified as not exploitable, 3. Database and security assessment, 4. UI/UX and accessibility assessment, 5. Test coverage and limitations, 6. Prioritised recommendations, 7. Changes made during the audit, Audit of the whole platform — 2026-10-19 (+4 more)

### Community 24 - "run.sh"
Cohesion: 0.28
Nodes (7): as_pg(), PGDATABASE, PGHOST, PGPORT, PGUSER, psql(), run.sh script

### Community 25 - "J. Deployment strategy"
Cohesion: 0.12
Nodes (14): Administrace – návod pro organizátory, Doprava, Jmenovky, Přehled, Přihlášení, Účastníci, Blockers needing the organisers, Database (+6 more)

### Community 26 - "admin/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../tsconfig.base.json

### Community 27 - "LourdesMap.tsx"
Cohesion: 0.22
Nodes (9): expo@~58.0.15, leaflet@1.9.4, CENTER, esc(), LourdesMap(), MapPlace, Props, expo (+1 more)

### Community 28 - "i18n.ts"
Cohesion: 0.06
Nodes (27): 1. Issues resolved, 2. Test results (final run, this branch), 3. Blocked — not done, and why, 4. Remaining issues (open, with owner), 5. Readiness, 6. Health score: 88 / 100, 7. Changes made, Remediation of the audit findings — 2026-10-19 (+19 more)

### Community 30 - "C. Feature prioritisation"
Cohesion: 0.29
Nodes (6): 1. Essential MVP — must exist before a pilot, 2. Operational release — needed for the real pilgrimage, 3. Advanced, 4. Optional future, C. Feature prioritisation, Rejected (bloat)

### Community 31 - "Mobile / web app (`platform/app`, Expo)"
Cohesion: 0.29
Nodes (7): Account and privacy (every signed-in person), Admin dashboard (`platform/admin`, desktop web), G. Application navigation, Home — everyone, Medical (planned, Phase 7), Mobile / web app (`platform/app`, Expo), Team additions (any role)

### Community 32 - "Project status"
Cohesion: 0.33
Nodes (6): Blockers, By area, Housekeeping on the development project, Open questions for the organisers, Project status, What works today (development project, fictional data)

### Community 33 - "Aplikace pro tým – skenování, nástupy, služba"
Cohesion: 0.29
Nodes (6): Aplikace pro tým – skenování, nástupy, služba, Moje služba, Nahlásit problém, Ochrana údajů, Přihlášení, Skenování jmenovek

### Community 34 - "platform/package.json"
Cohesion: 0.29
Nodes (6): name, packageManager, private, scripts, test, typecheck

### Community 35 - "B. Product requirements"
Cohesion: 0.33
Nodes (6): B. Product requirements, Core use cases, Functional requirements (summary — detailed per module in [E](E-database.md) and [G](G-navigation.md)), Non-functional requirements, Personas, Purpose

### Community 36 - "E. Database architecture"
Cohesion: 0.33
Nodes (6): E. Database architecture, Entities, Functions (RPC), Integrity and concurrency, Migration strategy, Schemas

### Community 37 - "STATUS.md"
Cohesion: 0.16
Nodes (8): App Store and Google Play checklist, Before submission (organisers / store accounts), Done in the code, Pilgrimage platform, Content, Hosting, lurdy.eu, Online applications (`api/prihlaska.js`)

### Community 38 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 39 - "devDependencies"
Cohesion: 0.15
Nodes (13): { defineConfig }, expoConfig, devDependencies, eslint@^9.39.5, eslint-config-expo@~58.0.4, @types/leaflet@^1.9.22, @types/react@~19.3.0, typescript@~6.0.3 (+5 more)

### Community 40 - "Archive.tsx"
Cohesion: 0.07
Nodes (51): RFC-4180, Archive(), exportCsv(), remove(), czDate(), download(), downloadTemplate(), fold() (+43 more)

### Community 41 - "Aplikace Pouť do Lurd – návod pro poutníky a nemocné"
Cohesion: 0.40
Nodes (4): Aplikace Pouť do Lurd – návod pro poutníky a nemocné, Co v aplikaci najdete, Přihlášení, Ztracená jmenovka

### Community 43 - "app/tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 46 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../tsconfig.base.json

### Community 47 - "20261023110000_register_hardening.sql"
Cohesion: 0.38
Nodes (5): a_guard_varsym, app.audit(), app.erase_application(), app.guard_varsym(), y_erase_application

### Community 48 - "code-login/index.ts"
Cohesion: 0.11
Nodes (6): cors, admin, FORMS, LANGS, cors, cors

### Community 49 - "04_concurrency.sh"
Cohesion: 1.00
Nodes (3): q(), 04_concurrency.sh script, try()

### Community 54 - "public.editions"
Cohesion: 0.29
Nodes (17): public.editions, public.announcement_acks, public.announcements, public.contacts, public.duties, public.duty_assignments, public.events, public.facilities (+9 more)

### Community 57 - "site.js"
Cohesion: 0.25
Nodes (6): check(), mb(), render(), save(), say(), store()

### Community 62 - "20261019133339_remediation.sql"
Cohesion: 0.09
Nodes (23): a_guard_fields, app.assign_access_code(), app.check_capacity_change(), app.check_mobility_change(), app.config, app.guard_incident_fields(), app.member_edition_ids(), app.purge_logs() (+15 more)

### Community 65 - "20261019150000_advisor_followup.sql"
Cohesion: 0.15
Nodes (15): incidents_edition, public.incidents, announcement_acks_user, app.incident_summary(), duties_edition, duties_lead, duties_team, duty_assignments_edition (+7 more)

### Community 66 - "public.participants"
Cohesion: 0.10
Nodes (30): b_facility, public.participants, public.transport_legs, credentials_one_active, public.credentials, public.issue_credential(), public.my_digital_credential(), public.participant_card() (+22 more)

### Community 67 - "src/index.ts"
Cohesion: 0.08
Nodes (35): Application, forms, Status, statuses, Affecting, Assignment, Person, Announcement (+27 more)

### Community 68 - "Login.tsx"
Cohesion: 0.18
Nodes (18): App(), CodeLogin(), submit(), Login(), messages, setLoginFlash(), ResetPassword(), submit() (+10 more)

### Community 70 - "t"
Cohesion: 0.13
Nodes (22): fromLocalInput(), toLocalInput(), EventCodes(), add(), endNow(), randomEventCode(), audienceLabel(), categories (+14 more)

### Community 71 - "t"
Cohesion: 0.19
Nodes (36): CodeExpiryNotice(), routes, Shell(), useHashPath(), activeNow(), fmtDay(), fmtTime(), Icon() (+28 more)

### Community 72 - "Module"
Cohesion: 0.06
Nodes (34): Module(), a(), Aa(), bb(), c(), cc(), a(), d() (+26 more)

### Community 73 - "Badges.tsx"
Cohesion: 0.14
Nodes (17): fmtStamp(), czDate(), Row(), Badge(), Badges(), activate(), discard(), print() (+9 more)

### Community 74 - "admin/vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, installCommand, outputDirectory, $schema

### Community 82 - "20261022120000_archive.sql"
Cohesion: 0.53
Nodes (5): app.is_any_organizer(), archive_people_once, archive_people_year, public.archive_people, z_audit

### Community 84 - "09_remediation.sql"
Cohesion: 0.50
Nodes (3): c, newsecret, qr

### Community 89 - "friendlyError"
Cohesion: 0.10
Nodes (33): friendlyError(), affected(), FacilityForm(), remove(), save(), Decide(), accept(), decline() (+25 more)

### Community 92 - "Register.tsx"
Cohesion: 0.06
Nodes (61): AddPerson(), add(), Capacities(), save(), capFields, Check(), czk(), Detail() (+53 more)

### Community 96 - "20261023100000_registration_register.sql"
Cohesion: 0.18
Nodes (14): applications_edition, applications_participant, public.accept_application(), public.applications, z_audit, a_edition, app.assign_varsym(), app.check_private_edition() (+6 more)

## Knowledge Gaps
- **10 isolated node(s):** `../tsconfig.base.json`, `expo/tsconfig.base`, `RFC-6238`, `RFC-6238`, `RFC-4180` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 546 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `active()` connect `Register.tsx` to `E. Database architecture`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `Module()` (e.g. with `ac()` and `$b()`) actually correct?**
  _`Module()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../tsconfig.base.json`, `expo/tsconfig.base`, `RFC-6238` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `steps` be split into smaller, more focused modules?**
  _Cohesion score 0.09666666666666666 - nodes in this community are weakly interconnected._
- **Why does `E. Database architecture` connect `E. Database architecture` to `ROADMAP.md`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07331334332833583 - nodes in this community are weakly interconnected._
- **Why does `Entities` connect `E. Database architecture` to `Register.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._