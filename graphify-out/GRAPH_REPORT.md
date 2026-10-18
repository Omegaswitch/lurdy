# Graph Report - lurdy  (2026-10-18)

## Corpus Check
- 119 files · ~355,738 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: .woff2 24, (none) 4, .example 2)

## Summary
- 847 nodes · 1607 edges · 62 communities (46 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3feabe1d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Badges.tsx
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
- Project status
- AGENTS.md
- devDependencies
- serve
- Aplikace Pouť do Lurd – návod pro poutníky a nemocné
- eslint.config.js
- app/tsconfig.json
- shim.sql
- qr.ts
- shared/tsconfig.json
- lurdy.eu
- code-login/index.ts
- 04_concurrency.sh
- 06_seed_dev.sh
- css.d.ts
- assets/README.md
- 03_scan.sql
- 05_code_login.sql

## God Nodes (most connected - your core abstractions)
1. `T()` - 32 edges
2. `useStore()` - 28 edges
3. `t()` - 27 edges
4. `Screen()` - 25 edges
5. `Card()` - 23 edges
6. `public.participants` - 23 edges
7. `Notice()` - 19 edges
8. `Badges()` - 18 edges
9. `BigButton()` - 18 edges
10. `useReady()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `toggleRole()` --calls--> `friendlyError()`  [EXTRACTED]
  platform/admin/src/pages/Participants.tsx → platform/admin/src/errors.ts
- `submit()` --calls--> `signInWithCode()`  [EXTRACTED]
  platform/admin/src/pages/Login.tsx → platform/admin/src/supabase.ts
- `submit()` --calls--> `t()`  [EXTRACTED]
  platform/admin/src/pages/Mfa.tsx → platform/shared/src/i18n.ts
- `RootLayout()` --calls--> `StoreProvider()`  [EXTRACTED]
  platform/app/src/app/_layout.tsx → platform/app/src/lib/store.tsx
- `submit()` --calls--> `signInWithCode()`  [EXTRACTED]
  platform/app/src/app/login.tsx → platform/app/src/lib/supabase.ts

## Import Cycles
- None detected.

## Communities (62 total, 16 thin omitted)

### Community 0 - "Badges.tsx"
Cohesion: 0.06
Nodes (78): App(), routes, Shell(), useHashPath(), friendlyError(), fmtDay(), fmtStamp(), fmtTime() (+70 more)

### Community 1 - "ui.tsx"
Cohesion: 0.11
Nodes (62): Badge(), Duty(), MyLeg, call(), Help(), Home(), Journey(), RootLayout() (+54 more)

### Community 2 - "build.py"
Cohesion: 0.07
Nodes (32): build(), contact_card(), crumbs_html(), date_span(), downloads(), facts(), faq_list(), field_html() (+24 more)

### Community 3 - "20261018211334_operations.sql"
Cohesion: 0.10
Nodes (44): a_inherit, app.check_care_roles(), app.check_leg_capacity(), app.check_room_capacity(), app.is_carer_of(), app.is_member(), app.my_category(), app.my_participant_ids() (+36 more)

### Community 4 - "admin/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @lurdy/shared, qrcode, react, react-dom, @supabase/supabase-js, devDependencies, @types/qrcode (+27 more)

### Community 5 - "helpers.ts"
Cohesion: 0.08
Nodes (25): devDependencies, @axe-core/playwright, @playwright/test, @supabase/supabase-js, typescript, @supabase/supabase-js, typescript, name (+17 more)

### Community 6 - "20261018211443_credentials_and_views.sql"
Cohesion: 0.13
Nodes (12): app.participant_card(), credentials_one_active, public.credentials, public.issue_credential(), public.my_digital_credential(), public.participant_card(), public.revoke_credential(), public.scan_badge() (+4 more)

### Community 7 - "20261018211208_foundation.sql"
Cohesion: 0.13
Nodes (15): app.active_user(), app.has_role(), app.is_medical(), app.is_super_admin(), app.on_auth_user_created(), audit.log, audit_log_edition_at, audit_log_row (+7 more)

### Community 8 - "expo"
Cohesion: 0.08
Nodes (24): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo (+16 more)

### Community 9 - "app/package.json"
Cohesion: 0.08
Nodes (23): @lurdy/shared, react, react-dom, @supabase/supabase-js, @types/react, typescript, main, name (+15 more)

### Community 10 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, expo, expo-camera, expo-constants, expo-font, @expo-google-fonts/asap, expo-linking, expo-location (+15 more)

### Community 11 - "types.ts"
Cohesion: 0.10
Nodes (18): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+10 more)

### Community 12 - "prihlaska.js"
Cohesion: 0.13
Nodes (11): esc(), fail(), FORMS, SITE, TEXT, assert, call(), good (+3 more)

### Community 13 - "20261018213424_code_login.sql"
Cohesion: 0.20
Nodes (9): a_inherit, app.has_role(), app.my_roles(), audit.login_attempts, login_attempts_code_at, login_attempts_ip_at, public.code_login_check(), public.set_account_status() (+1 more)

### Community 14 - "Observed workflows and their digital replacement"
Cohesion: 0.12
Nodes (15): 10. Night shifts, meal service, cleaning (doc 2), 11. Team meals and vouchers (doc 2), 1. Programme and daily schedule (docs 1, 2), 2. Different instructions for pilgrims and team (docs 1 vs 2), 3. Team roster and responsibilities (docs 2, 3), 4. Sick person ↔ carer assignment (docs 5, 6, 2), 5. Accommodation and rooms (docs 1, 2, 5), 6. Airport and bus coordination (doc 2) (+7 more)

### Community 15 - "D. Architecture decision record"
Cohesion: 0.12
Nodes (16): ADR-10 Brand — accepted, ADR-11 Sign-in by personal code — accepted (organisers' decision), ADR-12 Field app is big-button, edits happen on the web — accepted (organisers' decision), ADR-13 Map: Leaflet + OpenStreetMap as an Expo DOM component — accepted, ADR-1 Backend: Supabase (mandated) — accepted, ADR-2 Authorisation lives in the database — accepted, ADR-3 Medical data in a separate, unexposed schema — accepted, ADR-4 Two clients, one shared package — accepted (+8 more)

### Community 16 - "ROADMAP.md"
Cohesion: 0.24
Nodes (3): I. Testing strategy, DPIA outline (to be completed by the data controller), Pilgrimage platform

### Community 17 - "shared/package.json"
Cohesion: 0.14
Nodes (13): devDependencies, typescript, vitest, typescript, vitest, main, name, private (+5 more)

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
Cohesion: 0.29
Nodes (6): cs, Dict, dictionaries, en, Language, languages

### Community 30 - "C. Feature prioritisation"
Cohesion: 0.29
Nodes (6): 1. Essential MVP — must exist before a pilot, 2. Operational release — needed for the real pilgrimage, 3. Advanced, 4. Optional future, C. Feature prioritisation, Rejected (bloat)

### Community 31 - "Mobile / web app (`platform/app`, Expo)"
Cohesion: 0.29
Nodes (6): Admin dashboard (`platform/admin`, desktop web), G. Application navigation, Home — everyone, Medical (planned, Phase 7), Mobile / web app (`platform/app`, Expo), Team additions (any role)

### Community 32 - "Administrace – návod pro organizátory"
Cohesion: 0.29
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

### Community 37 - "Project status"
Cohesion: 0.33
Nodes (6): Blockers, By area, Housekeeping on the development project, Open questions for the organisers, Project status, What works today (development project, fictional data)

### Community 38 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 39 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, eslint, eslint-config-expo, @types/leaflet, @types/react, typescript

### Community 40 - "serve"
Cohesion: 0.60
Nodes (5): serve(), do_GET(), do_POST(), end_headers(), guess_type()

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

### Community 47 - "lurdy.eu"
Cohesion: 0.50
Nodes (4): Content, Hosting, lurdy.eu, Online applications (`api/prihlaska.js`)

### Community 49 - "04_concurrency.sh"
Cohesion: 1.00
Nodes (3): q(), 04_concurrency.sh script, try()

## Knowledge Gaps
- **35 isolated node(s):** `@lurdy/shared`, `@supabase/supabase-js`, `react`, `react-dom`, `@types/qrcode` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 427 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `qrcode` connect `admin/package.json` to `Badges.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `@lurdy/shared`, `@supabase/supabase-js`, `react` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Badges.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061107938320959454 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `ui.tsx` to `app/package.json`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10642570281124498 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `app/package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `build.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._