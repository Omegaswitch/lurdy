# Project status

Legend: ✅ implemented and tested · 🟡 implemented, partly tested (see note) · 🧪 development data / simulated · ⏳ in progress · ⬜ not started · ⛔ blocked (needs organisers)

Last updated: 2026-10-18.

## What works today (development project, fictional data)
The core loop runs end to end on the real backend and is covered by an automated test (`platform/e2e`, Playwright):
organiser signs in (code + event code + authenticator) → creates a participant → assigns Bus A → prints the badge → a team member scans it in the app (Bus A) → organiser moves the person to Bus C → **the participant's open app switches to Bus C by itself** and **the same printed badge scans as Bus C**. Scan round trip measured from the test runner: p50 ≈ 150–370 ms, p95 ≈ 370–510 ms (target < 2 s).

## By area
| Phase | Item | State | Note |
|---|---|---|---|
| Plan | Planning documents A–J, roadmap | ✅ | `docs/` |
| 1 | Schema, RLS, roles, MFA levels, audit, versioning, capacity | ✅ | 6 migrations; SQL suite `supabase/tests/run.sh` (access matrix, integrity, scan, code login, race, seed); hosted = local (fingerprints) |
| 1 | Sign-in by code (+ event code, + MFA for privileged) | ✅ | Edge Function `code-login`; throttling tested; live-tested |
| 2 | QR credentials, `scan_badge`, `staff_action`, `my_pilgrimage` | ✅ | |
| 2 | Admin: sign-in + MFA enrolment, participants (create/edit/delete, roles), transport (legs, assign, move, remove, capacity), badges (mm layout, A4, crop marks, PDF) | ✅ | e2e + axe (WCAG 2.2 AA rules) on overview and participant screens |
| 2 | App: sign-in, home, journey, programme, accommodation, help, my code, scanner, my duty, report, map | 🟡 | tested in the **web build** (e2e + screenshots); **not yet run on a physical iPhone/Android** (needs EAS build) — camera scanning and GPS only exercised in the browser |
| 2 | Realtime updates (admin lists, participant app) | ✅ | proven by e2e |
| 2 | Offline: participant app shows last copy with "as of" time | 🟡 | implemented; no automated offline test yet |
| 2 | Lourdes map (OSM, places from the programme, navigate, my location) | 🟡 | 14 sanctuary places with OSM positions; works in web build; device check pending |
| 3 | Edition settings + event codes (before/during, end now) in admin | ✅ | e2e + axe |
| 3 | CSV import (preview, duplicate detection vs. database and within file, per-row decision) and CSV export | ✅ | e2e: 151-row file with 5 planted duplicates + 1 error flagged exactly; 18 unit tests |
| 3 | Edition create/duplicate/archive | ⬜ | |
| 4 | Accommodation (facilities, rooms, occupancy, house/move/remove, room responsible) in admin | ✅ | e2e + axe; capacity refused by the database |
| 4 | Care assignments (primary/backup/temporary with period, gaps, carer load) in admin | ✅ | e2e + axe |
| 4 | Teams & duties screens in admin | ⬜ | database and app view ready |
| 5 | Prints: alphabetical, by category, leg manifests (one per page, boarding tick column), room sheets, care roster, programme, contacts — every page stamped with edition + time + page numbers | ✅ | e2e renders PDFs; duty roster waits for the duties screen |
| 6 | Programme editor (audiences, map place, change marker), contacts, announcements (draft/publish, critical + acknowledgements) | ✅ | e2e verifies what the participant receives |
| 6 | Places editor (map pins) in admin | ⬜ | 14 shared sanctuary places seeded |
| 7 | Medical module (records, step-up, carer-shareable info, break-glass, access log, purge) | ⬜ | schema `medical` exists and is locked; helpers `is_medical`, `mfa_fresh` tested |
| 8 | Push notifications, incident workflow in admin, offline scanning queue | ⬜ | incident reporting from the app works (insert) |
| 8 | App lock (biometric/PIN) for team phones | ⬜ | planned with the device builds |
| 9 | Accessibility manual audit, security review, backups/restore drill, deployment | ⬜ | |

## Open questions for the organisers
| # | Question | Default until answered |
|---|---|---|
| Q1 | Supabase project is in **eu-west-1 (Ireland)**, brief preferred Frankfurt. Keep or recreate? | keep (EU region) |
| Q2 | Who is the data controller and DPIA owner? | Foundation that runs the forms on lurdy.eu |
| Q3 | Print the category "malade" on badges? | **decided 2026-10-19: yes, large** (with the bus code) |
| Q4 | Is `LurdyAPP` the future production or the staging project? | development/staging |
| Q5 | 4-digit code alone for pilgrims — accepted residual risk (F §2). Add a personal PIN later? | code only (decided 2026-10-18) |

## Housekeeping on the development project
- Three fictional test organisers ("Ota Testovací-organizátor", "-2", and code 7700) carry orphaned authenticator factors from early test runs. Harmless (fictional), but the factors can only be removed with a `DELETE` on `auth.mfa_factors`, which the Supabase tool asks you to confirm. Tests now use organiser `2936`, which keeps one factor permanently; its secret is in `platform/e2e/.mfa-secrets.json` (git-ignored) or `E2E_ORGANISER_TOTP`.
- `role_grants.user_id` is an unused, always-null column left by a non-destructive migration; drop it in a later migration when convenient.

## Blockers
See [J — Blockers needing the organisers](J-deployment.md#blockers-needing-the-organisers).
