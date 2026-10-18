# D. Architecture decision record

Priorities, in order: security, reliability, maintainability, cross-platform consistency, accessibility, development speed, running cost.

## Repository as found
`lurdy.eu` public website: Python static generator, five languages, Vercel, one serverless function that e-mails application forms. It stores nothing. It stays unchanged; the platform is added beside it:

```
docs/            planning, guides, status (this folder)
supabase/        migrations, SQL tests, edge functions, config — the backend
platform/
  shared/        TypeScript: database types, domain rules, i18n strings (used by both clients)
  admin/         desktop web dashboard (Vite + React + TypeScript)
  app/           participant + staff app (Expo / React Native: iOS, Android, web)
```

## ADR-1 Backend: Supabase (mandated) — accepted
Postgres + Auth + RLS + Realtime + Storage + Edge Functions. One database is the single source of truth for all clients; no second database. Project `LurdyAPP` already exists.
- **Region:** the project was created in **eu-west-1 (Ireland)**. Frankfurt was preferred; region cannot be changed after creation. Ireland is inside the EU/EEA, so GDPR transfer rules are met; latency difference is irrelevant here. *Decision:* keep, unless the organisers want Frankfurt — then create a new project before any real data (zero migration cost today). Recorded as open question Q1 in [STATUS](STATUS.md).
- Plan: **Pro** is required for production (daily backups, PITR add-on, no pausing, MFA enforcement, log retention). The free tier pauses inactive projects — unacceptable during the pilgrimage.

## ADR-2 Authorisation lives in the database — accepted
All rules are RLS policies and `SECURITY DEFINER` functions in Postgres, tested in SQL. Clients only ever hold the publishable (anon) key and the user's JWT. Edge Functions are used only where something cannot run in SQL (sending e-mail invitations, push notifications, admin user creation with the service key).
*Alternative rejected:* a custom API server (Node) in front of Postgres — more code, a second place for rules, same result.

## ADR-3 Medical data in a separate, unexposed schema — accepted
`medical.*` tables are **not** in the PostgREST-exposed schemas. The only way in is a small set of `public.medical_*` functions that check the medical grant, MFA level and recency, write an access log row, then return or change data. Nothing can select medical rows directly, so no RLS mistake elsewhere can leak them. See [F](F-security-privacy.md).

## ADR-4 Two clients, one shared package — accepted
| Option | For | Against |
|---|---|---|
| A. One Expo app for everything (incl. admin on web) | one codebase | dense tables, drag-and-drop, precise print CSS and CSV handling are poor on react-native-web |
| **B. Expo app (participants + staff, all platforms) + Vite React admin (desktop web)** | each tool fits its job; admin printing uses real CSS `@page`/mm | two UI codebases |
| C. Native Swift/Kotlin | best native feel | three codebases, not maintainable by volunteers |

**Decision: B.** The two clients share `platform/shared` (generated database types, category/role definitions, i18n strings, pure domain functions such as badge imposition and duplicate detection). Organisers work on laptops; field users on phones. The Expo app also builds for web, so a pilgrim without the store app can open it in a browser.

## ADR-5 Library choices — accepted (each is the smallest that does the job)
| Need | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | brief + type safety with generated DB types |
| Mobile | Expo (managed) + expo-router | one codebase iOS/Android/web, OTA updates, EAS builds |
| Admin | Vite + React, plain CSS with tokens | no UI kit to fight; Order of Malta tokens from the public site |
| Data | `@supabase/supabase-js` | official; Realtime included |
| QR (print) | `qrcode` → SVG | tiny, offline, crisp at any print size |
| QR (app display) | `react-native-qrcode-svg` | |
| Scanning | `expo-camera` barcode scanning | built in, fast; manual search fallback |
| PDF | browser print to PDF from admin print views (`@page`, mm units) | exact sizes, no server, no PDF library; server-side PDF only if a real need appears |
| Push | Expo Push Service from an Edge Function | one API for APNs + FCM |
| Offline | AsyncStorage JSON snapshot of "my pilgrimage" + staff leg manifest | no sync engine needed for read-mostly data |
| i18n | plain JSON dictionaries in `shared` | five languages already handled this way on the public site |
| Tests | SQL test scripts (psql), Vitest, Playwright + axe | |

## ADR-6 QR payload — accepted
The QR encodes `LRD1.<token>`: a version prefix and 128 random bits (base32, 26 characters). **Not a URL** — a phone camera that is not our app shows meaningless text, and nothing is fetched. The database stores only `sha256(token)`; the token itself exists on the printout and briefly in the print view. The token never changes when bus, room or name changes; it changes only when a badge is revoked (lost/stolen) and replaced.

## ADR-7 Concurrency: optimistic versioning — accepted
Every mutable operational row has `version int`. Clients update with `where id = ? and version = ?`; a trigger increments `version`. Zero affected rows → the client shows "someone changed this meanwhile", reloads, and lets the user re-apply. No silent overwrite. Every change is in the audit log (who, when, before, after).

## ADR-8 Realtime: Postgres changes, then refetch — accepted
Clients subscribe to changes on the tables of the active edition (RLS applies to Realtime). On an event they refetch the affected query. Simple and correct; fine for ~200 people.

## ADR-9 Hosting — proposed
Admin and app-web as static sites on Vercel (already used for lurdy.eu), e.g. `admin.lurdy.eu`, `app.lurdy.eu`; mobile via EAS Build → TestFlight / Play internal testing. Requires accounts and DNS — see [J](J-deployment.md). Not done without the organisers' go-ahead.

## ADR-10 Brand — accepted
Admin and app follow the Grand Magistry Entities theme already applied on lurdy.eu: red `#e31818`, greys `#f3f3f3/#c7c7c7`, text `#454545`, font Asap. Only the official shield asset is used, unaltered except for the approved web red; the acronym "SMOM" is never used (communications policy; checked automatically). Red is the brand colour, so it is **not** used for "error" states alone — errors always carry an icon and text.

## Open questions (recorded in STATUS)
- Q1 Region Ireland vs Frankfurt.
- Q2 Data controller and DPIA owner (the Foundation "Maltézský nadační fond LOURDES" runs the public site's forms).
- Q3 Whether "malade" category may be printed on badges (tradition vs. Art. 9). Default: **not printed**; the colour band shows the facility, as on the 2026 badges.
