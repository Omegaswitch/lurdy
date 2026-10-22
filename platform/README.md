# Pilgrimage platform

Admin web app, participant/staff app and shared code for the Lourdes pilgrimage platform. Backend: Supabase (`../supabase`). Plans and decisions: `../docs` (start with [ROADMAP](../docs/ROADMAP.md) and [STATUS](../docs/STATUS.md)).

| Folder | What | Run |
|---|---|---|
| `shared/` | database types, i18n (cs/en), QR format, badge imposition, icons, code sign-in call | `pnpm --filter @lurdy/shared test` |
| `admin/` | organisers' web dashboard (Vite + React) | `pnpm --filter @lurdy/admin dev` → http://localhost:5173 |
| `app/` | phone app for participants and the team (Expo: iOS, Android, web) | `cd app && npx expo start` |
| `e2e/` | end-to-end tests on the development project (they refuse to run against any edition but the fictional development one) | `cd e2e && npx playwright test` |

Setup: `pnpm install` here (Node 22, pnpm 10). Copy `admin/.env.example` → `admin/.env.local` and `app/.env.example` → `app/.env.local` (publishable key only — never the service key).

Checks before a commit:
```
../supabase/tests/run.sh            # database: RLS, integrity, scan, code login
pnpm -r typecheck && pnpm -r test   # TypeScript + unit tests
(cd app && npx expo lint)
(cd e2e && npx playwright test)     # needs the dev project and its fictional seed
```

Development sign-in (fictional seed, development project only). Phone app: attendee number + invitation code. Pilgrim `3672` / `DEVPUTNK`; team member `0505` / `DEVSTAFF` + event code `DEV123`. Admin: e-mail + password + authenticator, like the school sites; organiser and medical rights hold only in a password session with the second factor (`app.password_session()`), and a code session never gets them. First time (or to recover without e-mail): "První přihlášení" → attendee number + invitation code + event code + authenticator → set e-mail and password (Edge Function `admin-login-setup`). Test organiser `2936` / `DEVTEST3` + `DEV123`; the e2e run sets it up once and keeps the TOTP secret, e-mail and random password in `e2e/.mfa-secrets.json` (git-ignored; in CI `E2E_ORGANISER_TOTP`, `E2E_ORGANISER_EMAIL`, `E2E_ORGANISER_PASSWORD`). The local seed's test organiser uses `DEVTEST2`. The numbers are random per database: after a re-seed, read the new ones in the admin (participant editor); the invitation codes are fixed by `seed-dev.sql` for the development data only. Rotate before the project holds real data.

Rules the tests enforce: every new database function ends with `revoke execute … from public, anon` (`tests/08_hardening.sql` fails otherwise); queries on `participants` and `incidents` name their columns — `access_code`, `login_secret` and `incidents.summary` are withheld from the API (organisers read sign-in data through `participant_login`, incidents through the `incident_reports` view); the app's UI strings live in `shared/src/i18n.ts` (Czech and English must have the same keys — tested); the admin is Czech-only by decision.

Test suites: `supabase/tests/run.sh` (11 SQL suites: access, integrity, scan, concurrency, code login, seed, account deletion, hardening, remediation, archive, admin sign-in; `run.sh fingerprint` prints the schema fingerprint to compare with the hosted project), Vitest in `shared/` and `admin/`, Playwright in `e2e/` (admin + app web build against the development project, with axe accessibility checks on every admin screen and the app's screens).

Updating database types after a migration: regenerate `shared/src/database.types.ts` (Supabase CLI `supabase gen types typescript` or the Supabase MCP tool).
