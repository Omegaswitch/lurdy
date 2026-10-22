# Graph Report - lurdy  (2026-10-22)

## Corpus Check
- 176 files · ~450,912 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: .woff2 24, (none) 5, .example 2)

## Summary
- 1423 nodes · 2919 edges · 96 communities (65 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7939df0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Reports.tsx
- ui.tsx
- build.py
- 20261018211334_operations.sql
- admin/package.json
- helpers.ts
- 20261018211443_credentials_and_views.sql
- 20261018211208_foundation.sql
- expo
- app/package.json
- dependencies
- types.ts
- prihlaska.js
- 20261018213424_code_login.sql
- Observed workflows and their digital replacement
- D. Architecture decision record
- ROADMAP.md
- shared/package.json
- F. Security and privacy architecture
- Master roadmap — Lourdes pilgrimage platform
- compilerOptions
- vercel.json
- scripts
- 20261018212736_access_codes.sql
- run.sh
- J. Deployment strategy
- admin/tsconfig.json
- LourdesMap.tsx
- i18n.ts
- C. Feature prioritisation
- Mobile / web app (`platform/app`, Expo)
- Administrace – návod pro organizátory
- Aplikace pro tým – skenování, nástupy, služba
- platform/package.json
- B. Product requirements
- E. Database architecture
- STATUS.md
- AGENTS.md
- devDependencies
- Archive.tsx
- Aplikace Pouť do Lurd – návod pro poutníky a nemocné
- eslint.config.js
- app/tsconfig.json
- shim.sql
- public.code_login_check
- shared/tsconfig.json
- Applications.tsx
- code-login/index.ts
- 04_concurrency.sh
- 06_seed_dev.sh
- css.d.ts
- assets/README.md
- 03_scan.sql
- 05_code_login.sql
- site.js
- 20261019133339_remediation.sql
- 07_account_deletion.sql
- 20261019150000_advisor_followup.sql
- 20261019130248_hardening.sql
- t
- t
- Audit of the whole platform — 2026-10-19
- t
- src/index.ts
- Module
- Badges.tsx
- admin/vercel.json
- 08_hardening.sql
- 20261019123937_zz_probe_column_privileges.sql
- THIRD-PARTY.md
- 20261022120000_archive.sql
- app.has_role
- 09_remediation.sql
- Notice
- Transport.tsx
- lurdy.eu
- app.is_super_admin
- session.tsx
- public.applications
- app.edition_ids

## God Nodes (most connected - your core abstractions)
1. `friendlyError()` - 64 edges
2. `t()` - 62 edges
3. `Notice()` - 52 edges
4. `Module()` - 51 edges
5. `useReady()` - 40 edges
6. `T()` - 37 edges
7. `useStore()` - 33 edges
8. `Icon()` - 32 edges
9. `Screen()` - 30 edges
10. `Card()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Medium` --references--> `DuplicateIndex`  [INFERRED]
  docs/audits/2026-10-19-audit.md → platform/shared/src/csv.ts
- `7. Changes made` --references--> `encryptedStorage()`  [INFERRED]
  docs/audits/2026-10-19-remediation.md → platform/shared/src/encryptedStorage.ts
- `accept()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Applications.tsx → platform/admin/src/errors.ts
- `decline()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Applications.tsx → platform/admin/src/errors.ts
- `remove()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Applications.tsx → platform/admin/src/errors.ts

## Import Cycles
- None detected.

## Communities (96 total, 31 thin omitted)

### Community 0 - "Reports.tsx"
Cohesion: 0.16
Nodes (17): fmtDay(), Care, Contact, Data, downloadCsv(), Ed, Event, Facility (+9 more)

### Community 1 - "ui.tsx"
Cohesion: 0.07
Nodes (88): Account(), Badge(), useMaxBrightness(), Duty(), MyLeg, call(), Help(), Home() (+80 more)

### Community 2 - "build.py"
Cohesion: 0.05
Nodes (39): build(), contact_card(), crumbs_html(), date_span(), downloads(), facts(), faq_list(), field_html() (+31 more)

### Community 3 - "20261018211334_operations.sql"
Cohesion: 0.10
Nodes (44): a_inherit, app.check_care_roles(), app.check_leg_capacity(), app.check_room_capacity(), app.is_carer_of(), app.is_member(), app.my_category(), app.my_participant_ids() (+36 more)

### Community 4 - "admin/package.json"
Cohesion: 0.05
Nodes (38): dependencies, @lurdy/shared, qrcode, react, react-dom, read-excel-file, @supabase/supabase-js, write-excel-file (+30 more)

### Community 5 - "helpers.ts"
Cohesion: 0.07
Nodes (35): devDependencies, @axe-core/playwright, @playwright/test, read-excel-file, @supabase/supabase-js, typescript, write-excel-file, read-excel-file (+27 more)

### Community 6 - "20261018211443_credentials_and_views.sql"
Cohesion: 0.13
Nodes (12): app.participant_card(), credentials_one_active, public.credentials, public.issue_credential(), public.my_digital_credential(), public.participant_card(), public.revoke_credential(), public.scan_badge() (+4 more)

### Community 7 - "20261018211208_foundation.sql"
Cohesion: 0.13
Nodes (15): app.active_user(), app.has_role(), app.is_medical(), app.is_super_admin(), app.on_auth_user_created(), audit.log, audit_log_edition_at, audit_log_row (+7 more)

### Community 8 - "expo"
Cohesion: 0.06
Nodes (34): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, allowBackup, blockedPermissions, package (+26 more)

### Community 9 - "app/package.json"
Cohesion: 0.07
Nodes (27): aes-js, @lurdy/shared, react, react-dom, @supabase/supabase-js, @types/react, typescript, main (+19 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, aes-js, expo, expo-brightness, expo-camera, expo-constants, expo-crypto, expo-font (+21 more)

### Community 11 - "types.ts"
Cohesion: 0.11
Nodes (17): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+9 more)

### Community 12 - "prihlaska.js"
Cohesion: 0.08
Nodes (17): esc(), fail(), FORMS, INTAKE_FIELDS, INTAKE_FORM, MAGIC, SITE, TEXT (+9 more)

### Community 13 - "20261018213424_code_login.sql"
Cohesion: 0.20
Nodes (9): a_inherit, app.has_role(), app.my_roles(), audit.login_attempts, login_attempts_code_at, login_attempts_ip_at, public.code_login_check(), public.set_account_status() (+1 more)

### Community 14 - "Observed workflows and their digital replacement"
Cohesion: 0.13
Nodes (15): 10. Night shifts, meal service, cleaning (doc 2), 11. Team meals and vouchers (doc 2), 1. Programme and daily schedule (docs 1, 2), 2. Different instructions for pilgrims and team (docs 1 vs 2), 3. Team roster and responsibilities (docs 2, 3), 4. Sick person ↔ carer assignment (docs 5, 6, 2), 5. Accommodation and rooms (docs 1, 2, 5), 6. Airport and bus coordination (doc 2) (+7 more)

### Community 15 - "D. Architecture decision record"
Cohesion: 0.12
Nodes (16): ADR-10 Brand — accepted, ADR-11 Sign-in by personal code — accepted (organisers' decision), ADR-12 Field app is big-button, edits happen on the web — accepted (organisers' decision), ADR-13 Map: Leaflet + OpenStreetMap as an Expo DOM component — accepted, ADR-1 Backend: Supabase (mandated) — accepted, ADR-2 Authorisation lives in the database — accepted, ADR-3 Medical data in a separate, unexposed schema — accepted, ADR-4 Two clients, one shared package — accepted (+8 more)

### Community 17 - "shared/package.json"
Cohesion: 0.11
Nodes (18): dependencies, aes-js, devDependencies, @types/aes-js, typescript, vitest, aes-js, typescript (+10 more)

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
Cohesion: 0.20
Nodes (9): buildCommand, cleanUrls, framework, headers, installCommand, outputDirectory, redirects, $schema (+1 more)

### Community 22 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, android, export:web, ios, lint, start, test, typecheck (+1 more)

### Community 23 - "20261018212736_access_codes.sql"
Cohesion: 0.25
Nodes (3): a_access_code, public.staff_codes, z_audit

### Community 24 - "run.sh"
Cohesion: 0.28
Nodes (7): as_pg(), PGDATABASE, PGHOST, PGPORT, PGUSER, psql(), run.sh script

### Community 25 - "J. Deployment strategy"
Cohesion: 0.25
Nodes (8): Blockers needing the organisers, Database, Environments, J. Deployment strategy, Mobile, Operations during the pilgrimage, Pilot, Web (admin + app web)

### Community 26 - "admin/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../tsconfig.base.json

### Community 27 - "LourdesMap.tsx"
Cohesion: 0.29
Nodes (7): CENTER, esc(), LourdesMap(), MapPlace, Props, expo, leaflet

### Community 28 - "i18n.ts"
Cohesion: 0.06
Nodes (27): 1. Issues resolved, 2. Test results (final run, this branch), 3. Blocked — not done, and why, 4. Remaining issues (open, with owner), 5. Readiness, 6. Health score: 88 / 100, 7. Changes made, Remediation of the audit findings — 2026-10-19 (+19 more)

### Community 30 - "C. Feature prioritisation"
Cohesion: 0.29
Nodes (6): 1. Essential MVP — must exist before a pilot, 2. Operational release — needed for the real pilgrimage, 3. Advanced, 4. Optional future, C. Feature prioritisation, Rejected (bloat)

### Community 31 - "Mobile / web app (`platform/app`, Expo)"
Cohesion: 0.29
Nodes (7): Account and privacy (every signed-in person), Admin dashboard (`platform/admin`, desktop web), G. Application navigation, Home — everyone, Medical (planned, Phase 7), Mobile / web app (`platform/app`, Expo), Team additions (any role)

### Community 32 - "Administrace – návod pro organizátory"
Cohesion: 0.33
Nodes (6): Administrace – návod pro organizátory, Doprava, Jmenovky, Přehled, Přihlášení, Účastníci

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
Cohesion: 0.14
Nodes (10): App Store and Google Play checklist, Before submission (organisers / store accounts), Done in the code, Blockers, By area, Housekeeping on the development project, Open questions for the organisers, Project status (+2 more)

### Community 38 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 39 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, eslint, eslint-config-expo, @types/leaflet, @types/react, typescript

### Community 40 - "Archive.tsx"
Cohesion: 0.07
Nodes (48): RFC-4180, exportCsv(), czDate(), download(), downloadTemplate(), fold(), loadAll(), Person (+40 more)

### Community 41 - "Aplikace Pouť do Lurd – návod pro poutníky a nemocné"
Cohesion: 0.40
Nodes (4): Aplikace Pouť do Lurd – návod pro poutníky a nemocné, Co v aplikaci najdete, Přihlášení, Ztracená jmenovka

### Community 42 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 43 - "app/tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 46 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../tsconfig.base.json

### Community 47 - "Applications.tsx"
Cohesion: 0.20
Nodes (13): fmtStamp(), Application, czDate(), Decide(), accept(), decline(), Decided(), remove() (+5 more)

### Community 48 - "code-login/index.ts"
Cohesion: 0.11
Nodes (6): cors, admin, FORMS, LANGS, cors, cors

### Community 49 - "04_concurrency.sh"
Cohesion: 1.00
Nodes (3): q(), 04_concurrency.sh script, try()

### Community 57 - "site.js"
Cohesion: 0.25
Nodes (6): check(), mb(), render(), save(), say(), store()

### Community 62 - "20261019133339_remediation.sql"
Cohesion: 0.07
Nodes (21): a_guard_fields, app.check_capacity_change(), app.check_mobility_change(), app.config, app.edition_ids(), app.guard_incident_fields(), app.member_edition_ids(), c_capacity_change (+13 more)

### Community 65 - "20261019150000_advisor_followup.sql"
Cohesion: 0.06
Nodes (21): announcement_acks_user, app.incident_summary(), duties_edition, duties_lead, duties_team, duty_assignments_edition, emergency_contacts_edition, events_place (+13 more)

### Community 66 - "20261019130248_hardening.sql"
Cohesion: 0.13
Nodes (14): a_guard_user, app.guard_participant_user(), participants_access_code_lookup, public.code_login_check(), public.find_participants(), public.my_digital_credential(), public.my_digital_credential_valid(), public.participant_access_code() (+6 more)

### Community 67 - "t"
Cohesion: 0.12
Nodes (29): friendlyError(), Icon(), save(), Archive(), remove(), create(), publish(), AiPrompt() (+21 more)

### Community 68 - "t"
Cohesion: 0.18
Nodes (22): App(), CodeExpiryNotice(), routes, Shell(), useHashPath(), Edition(), save(), CodeLogin() (+14 more)

### Community 69 - "Audit of the whole platform — 2026-10-19"
Cohesion: 0.17
Nodes (12): 1. Findings by severity, 2. Issues verified as not exploitable, 3. Database and security assessment, 4. UI/UX and accessibility assessment, 5. Test coverage and limitations, 6. Prioritised recommendations, 7. Changes made during the audit, Audit of the whole platform — 2026-10-19 (+4 more)

### Community 70 - "t"
Cohesion: 0.16
Nodes (20): fmtTime(), fromLocalInput(), toLocalInput(), Code, EventCodes(), add(), endNow(), randomEventCode() (+12 more)

### Community 71 - "src/index.ts"
Cohesion: 0.13
Nodes (18): fullName(), Affecting, Facility, fold(), kindLabel, kinds, Occupant, Person (+10 more)

### Community 72 - "Module"
Cohesion: 0.06
Nodes (32): Module(), a(), Aa(), bb(), c(), cc(), a(), d() (+24 more)

### Community 73 - "Badges.tsx"
Cohesion: 0.15
Nodes (15): Badge(), Badges(), activate(), discard(), print(), saveConfig(), Batch, batchKey() (+7 more)

### Community 74 - "admin/vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, installCommand, outputDirectory, $schema

### Community 82 - "20261022120000_archive.sql"
Cohesion: 0.43
Nodes (5): app.is_any_organizer(), archive_people_once, archive_people_year, public.archive_people, z_audit

### Community 84 - "09_remediation.sql"
Cohesion: 0.50
Nodes (3): c, newsecret, qr

### Community 88 - "Notice"
Cohesion: 0.31
Nodes (16): activeNow(), Notice(), must(), useLive(), Accommodation(), FacilityForm(), remove(), save() (+8 more)

### Community 89 - "Transport.tsx"
Cohesion: 0.11
Nodes (24): affected(), Announcement, Announcements(), edit(), remove(), unpublish(), audienceOptions, Communication() (+16 more)

### Community 90 - "lurdy.eu"
Cohesion: 0.50
Nodes (4): Content, Hosting, lurdy.eu, Online applications (`api/prihlaska.js`)

### Community 92 - "session.tsx"
Cohesion: 0.19
Nodes (8): AuthContext, AuthProvider(), AuthState, Ctx, Edition, participantColumns, resolve(), Role

### Community 93 - "public.applications"
Cohesion: 0.33
Nodes (5): applications_edition, applications_participant, public.accept_application(), public.applications, z_audit

## Knowledge Gaps
- **44 isolated node(s):** `@lurdy/shared`, `@supabase/supabase-js`, `react`, `react-dom`, `read-excel-file` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 663 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `encryptedStorage()` connect `i18n.ts` to `ui.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `Module()` (e.g. with `ac()` and `$b()`) actually correct?**
  _`Module()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@lurdy/shared`, `@supabase/supabase-js`, `react` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06887052341597796 - nodes in this community are weakly interconnected._
- **Why does `Remediation of the audit findings — 2026-10-19` connect `i18n.ts` to `STATUS.md`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `build.py` be split into smaller, more focused modules?**
  _Cohesion score 0.054244306418219465 - nodes in this community are weakly interconnected._
- **Should `20261018211334_operations.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.1011764705882353 - nodes in this community are weakly interconnected._