# Pilgrimage platform

Admin web app, participant/staff app and shared code for the Lourdes pilgrimage platform. Backend: Supabase (`../supabase`). Plans and decisions: `../docs` (start with [ROADMAP](../docs/ROADMAP.md) and [STATUS](../docs/STATUS.md)).

| Folder | What | Run |
|---|---|---|
| `shared/` | database types, i18n (cs/en), QR format, badge imposition, icons, code sign-in call | `pnpm --filter @lurdy/shared test` |
| `admin/` | organisers' web dashboard (Vite + React) | `pnpm --filter @lurdy/admin dev` → http://localhost:5173 |
| `app/` | phone app for participants and the team (Expo: iOS, Android, web) | `cd app && npx expo start` |
| `e2e/` | end-to-end tests on the development project | `cd e2e && npx playwright test` |

Setup: `pnpm install` here (Node 22, pnpm 10). Copy `admin/.env.example` → `admin/.env.local` and `app/.env.example` → `app/.env.local` (publishable key only — never the service key).

Checks before a commit:
```
../supabase/tests/run.sh            # database: RLS, integrity, scan, code login
pnpm -r typecheck && pnpm -r test   # TypeScript + unit tests
(cd app && npx expo lint)
(cd e2e && npx playwright test)     # needs the dev project and its fictional seed
```

Development sign-in (fictional seed, development project only): pilgrim `3672`; team member `0505` + event code `DEV123`; test organiser `2936` + `DEV123` + authenticator (its TOTP secret is kept in `e2e/.mfa-secrets.json` after the first test run).

Updating database types after a migration: regenerate `shared/src/database.types.ts` (Supabase CLI `supabase gen types typescript` or the Supabase MCP tool).
