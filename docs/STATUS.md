# Project status

Legend: ✅ implemented and tested · 🟡 implemented, partly tested (see note) · 🧪 development data / simulated · ⏳ in progress · ⬜ not started · ⛔ blocked (needs organisers)

Last updated: 2026-10-22.

## What works today (development project, fictional data)
The core loop runs end to end on the real backend and is covered by an automated test (`platform/e2e`, Playwright):
organiser signs in (e-mail + password + authenticator; set up once through number + invitation code + event code) → creates a participant → assigns Bus A → prints the badge → a team member scans it ("not active yet") → organiser confirms the print → the badge scans (Bus A) → organiser moves the person to Bus C → **the participant's open app switches to Bus C by itself** and **the same printed badge scans as Bus C**. Scan round trip measured from the test runner: p50 ≈ 150–370 ms, p95 ≈ 370–510 ms (target < 2 s).

## By area
| Phase | Item | State | Note |
|---|---|---|---|
| Plan | Planning documents A–J, roadmap | ✅ | `docs/` |
| 1 | Schema, RLS, roles, MFA levels, audit, versioning, capacity | ✅ | 13 migrations (two are audit probes); SQL suite `supabase/tests/run.sh` (access matrix, integrity, scan, code login, race, seed, account deletion, hardening, remediation); hosted = local (fingerprints checked 2026-10-19 after the remediation) |
| 1 | Sign-in by attendee number + invitation code (QR / link fills both; + event code for the team) — phone app; in the admin only for the one-time setup | ✅ | Edge Function `code-login` v4; throttling tested; live-tested; invitation codes shown in the editor and the export, re-issuable |
| 2 | QR credentials, `scan_badge`, `staff_action`, `my_pilgrimage`; printed badges pending until the organiser confirms the print | ✅ | e2e: a pending badge scans as "not active yet", then as valid after *Aktivovat* |
| 2 | Admin: sign-in (e-mail + password + authenticator, like the school sites; forgotten password by e-mail with the authenticator code; first-time setup through the invitation codes, Edge Function `admin-login-setup`) + MFA enrolment, participants (create/edit/delete, roles, invitation code), transport (legs create/edit/delete, assign, move, remove, capacity), badges (mm layout, A4, crop marks, PDF, pending batches) | ✅ | e2e + axe (WCAG 2.2 AA rules) on overview, participant, transport screens |
| 2 | App: sign-in, home, journey, programme, accommodation, help, my code (full brightness + screen kept on), scanner, my duty, report, map, account & privacy | 🟡 | tested in the **web build** (e2e + screenshots); **not yet run on a physical iPhone/Android** (needs EAS build) — camera scanning and GPS only exercised in the browser |
| 2 | Realtime updates (admin lists, participant app) | ✅ | proven by e2e |
| 2 | Offline: participant app shows last copy with "as of" time; scanner queues scans made without signal (idempotent replay) and caches the leg list | 🟡 | implemented, unit-level logic covered; no automated offline e2e yet (needs a device or a network-throttled browser run) |
| 2 | Lourdes map (OSM, places from the programme, navigate, my location) | 🟡 | 14 sanctuary places with OSM positions, 4 with credited Wikimedia Commons photos; works in web build; device check pending |
| 2 | Same functions on the web (no app needed) | 🟡 | the app's web build is the same code: every screen works in a browser. Differences: a browser cannot raise screen brightness (the code screen says so and keeps the screen on); camera scanning depends on the browser — typing/pasting the code always works |
| 2 | App-store requirements: in-app account deletion, public privacy notice (`/privacy`), privacy manifest, encryption flag, minimal permissions, encrypted session storage | ✅ | e2e deletes an account through the app; checklist [security/app-store-checklist.md](security/app-store-checklist.md); privacy text needs the controller's name (Q2) |
| 3 | Edition settings + event codes (before/during, end now) in admin | ✅ | e2e + axe |
| 3 | Bulk import from Excel (.xlsx) or CSV: downloadable template, prompt to let any AI reformat an own sheet, preview, duplicate detection vs. database and within file, per-row decision; CSV export | ✅ | e2e: 151-row CSV with 5 planted duplicates + 1 error flagged exactly; template download, unknown layout → AI prompt with its headers, filled .xlsx previewed; 21 unit tests |
| 3 | Archive of past pilgrimages (pilgrims, malades, team by year): upload formatted CSV/Excel, preview, duplicates skipped, search, CSV export; organisers and super admins only, no health columns (they are skipped on import) | ✅ | SQL suite `10_archive` (access matrix, audit, no health column); e2e upload/duplicate/export/delete; 7 unit tests |
| 3 | Applications from the website (lurdy.eu forms) → admin *Přihlášky*: accept into participants (codes created) or decline; identity, contact and emergency contact only (health answers, ID number and attachments stay in the e-mail); Edge Function `application-intake` with a shared secret | ✅ | SQL suite `12_applications`; website test (fields sent, platform outage does not fail the applicant); browser check of accept/decline. **Not connected yet**: needs the secret in Supabase and Vercel, and a project approved for real data |
| 3 | **Registr** — the organisers' registration register (their Google Sheet "Participants" tab, same workflow, redesigned as a working list): VarSym (running personal number = payment variable symbol), P/M/T, waiting list and cancelled (never deleted), roles (nurse, doctor, priest, SMOM, lead, luggage team, plane → Accueil, truck), hotel/Accueil, letters w/x/o with the next one due, payments; the plane's seats against capacity and quotas, letters due, missing e-mails, money left; tabs = the sheet's tabs; bulk "letter sent"; prints: buses by the sheet's rules, letters due (CSV for mail merge), room lists. Passport and payments organisers-only. Website forms ask M/F | ✅ | SQL suite `14_register`; 6 unit tests on the sheet's rules (`shared/register.ts`); browser check desktop + phone, axe clean. Audited 2026-10-23 (independent security + code review, advisors, full e2e): fixes in `20261023110000_register_hardening` (erasure covers passport/payments/application; VarSym assigned by the database only; private rows live) and in the screen (money of active people only, no overwrite of a colleague's edit, edits not masked, nobody seated twice). No client data imported: the database stays clean |
| 3 | E-mails in the website's style (lockup, "Řádová pouť do Lurd"): full application to the organisers' inbox, confirmation to the applicant in their language (no application data), short notice to the addresses a master admin chooses in Přihlášky | ✅ | website test (recipients, content, no health or contact data in the notice); SQL suite `13_application_notify` |
| 3 | CSV download of every printable report (lists, manifests, rooms, care, programme, contacts) | ✅ | e2e |
| 3 | Edition create/duplicate/archive | ⬜ | |
| 4 | Accommodation (facilities create/edit/delete, rooms create/edit, occupancy, house/move/remove, room responsible) in admin | ✅ | e2e + axe; capacity refused by the database; shrinking below occupancy refused |
| 4 | Care assignments (primary/backup/temporary with period, gaps, carer load) in admin | ✅ | e2e + axe |
| 4 | Teams & duties screens in admin | ⬜ | database and app view ready |
| 5 | Prints: alphabetical, by category, leg manifests (one per page, boarding tick column), room sheets, care roster, programme, contacts — every page stamped with edition + time + page numbers | ✅ | e2e renders PDFs; duty roster waits for the duties screen |
| 6 | Programme editor (audiences, map place, change marker), contacts (edit in place), announcements (draft/publish/unpublish, edit, critical + acknowledgements) | ✅ | e2e verifies what the participant receives, and that an unpublished announcement disappears |
| 6 | Places editor (map pins) in admin | ⬜ | 14 shared sanctuary places seeded |
| 7 | Medical module (records, step-up, carer-shareable info, break-glass, access log, purge) | ⬜ | schema `medical` exists and is locked; helpers `is_medical`, `mfa_fresh` tested |
| 8 | Push notifications, incident workflow in admin | ⬜ | incident reporting from the app works (insert); a medical incident's text is readable only by the medical role (`incident_reports` view) |
| 8 | App lock (biometric/PIN) for team phones | ⬜ | planned with the device builds |
| 9 | Security and quality audit of the whole platform | 🟡 | first full audit 2026-10-19: [docs/audits/2026-10-19-audit.md](audits/2026-10-19-audit.md) — 2 Critical + 6 High fixed the same day; remediation of the rest the same day: [docs/audits/2026-10-19-remediation.md](audits/2026-10-19-remediation.md). Verdict: PASS for testing with fictional data; real participant data waits on the organisers' items (plan, DPIA, retention approval, device tests); real health data waits on the medical module |
| 9 | Accessibility manual audit (screen reader on a real phone), backups/restore drill, deployment | ⬜ | |

## Open questions for the organisers
| # | Question | Default until answered |
|---|---|---|
| Q1 | Supabase project is in **eu-west-1 (Ireland)**, brief preferred Frankfurt. Keep or recreate? | keep (EU region) |
| Q2 | Who is the data controller and DPIA owner? | Foundation that runs the forms on lurdy.eu |
| Q3 | Print the category "malade" on badges? | **decided 2026-10-19: yes, large** (with the bus code) |
| Q4 | Is `LurdyAPP` the future production or the staging project? | development/staging |
| Q6 | One-click "reformat with AI" inside the admin (sends the sheet to Anthropic's API from our server) instead of copy-paste? Needs an API key, a processor agreement and a DPIA note. | copy-paste prompt only: the organiser chooses an approved AI service themselves |
| Q7 | Map photos are loaded from Wikimedia's servers. Copy them into our own storage before production? | load from Wikimedia (credited, CC BY-SA) |
| Q5 | ~~4-digit code alone for pilgrims~~ **Resolved 2026-10-19 (remediation):** sign-in needs the 4-digit number *and* an 8-character invitation code; the invitation's QR code or link fills both, so the typing effort for a pilgrim is unchanged when they scan. The number stays the attendee identifier. | — |
| Q8 | Audit-log retention period (F §9). The purge job exists and runs nightly; personal fields of deleted people are scrubbed from the audit log at deletion time; sign-in attempts go after 30 days. **Audit-log rows are deleted only once a super admin records the approved period** with `select approve_log_retention(<days>);`. Who approves, and how many days? | keep everything until approved (proposal: 365 days) |

## Housekeeping on the development project
- `app.zz_probe` is a leftover of the audit's column-privilege probe (one row, no personal data). Dropping it is a `DROP TABLE`, which the Supabase tool asks you to confirm: `drop table app.zz_probe;`.
- Leaked-password protection is off on the project; organisers now sign into the admin with a password, so switch it on in Authentication → Settings.
- Password-reset e-mails: set up custom SMTP (Authentication → SMTP) — the built-in sender is rate-limited and meant for testing — and add the admin's address to Authentication → URL configuration → Redirect URLs. Until then, an organiser who forgot the password repeats the first-time setup (invitation codes + authenticator).
- Admin sessions stay signed in until **Odhlásit** (the 30-minute idle sign-out from audit item M3 was removed at the owner's request, 2026-10-22): the authenticator is asked once per sign-in on each device. Organisers must sign out on shared computers.
- Each organiser and medical team member does the one-time setup (e-mail + password) before their first admin sign-in.
- Set `VITE_APP_URL` on the admin's hosting to the app's public address before the first real invitations are exported (default `https://app.lurdy.eu`).
- The admin's `participants` and `incidents` queries must name their columns (`select=*` is refused by the column privileges); the e2e suite and the SQL suite catch a regression.
- Three fictional test organisers ("Ota Testovací-organizátor", "-2", and code 7700) carry orphaned authenticator factors from early test runs. Harmless (fictional), but the factors can only be removed with a `DELETE` on `auth.mfa_factors`, which the Supabase tool asks you to confirm. Tests now use organiser `2936`, which keeps one factor permanently; its secret is in `platform/e2e/.mfa-secrets.json` (git-ignored) or `E2E_ORGANISER_TOTP`.
- `role_grants.user_id` is an unused, always-null column left by a non-destructive migration; drop it in a later migration when convenient.

## Blockers
See [J — Blockers needing the organisers](J-deployment.md#blockers-needing-the-organisers).
