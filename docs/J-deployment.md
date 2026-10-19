# J. Deployment strategy

## Environments
| Environment | Supabase | Web hosting | Mobile | Data |
|---|---|---|---|---|
| Local | local Postgres (tests) or `supabase start` (Docker) | `vite` / `expo start` | Expo Go / dev build | fictional seed |
| Development | `LurdyAPP` project (eu-west-1) until a staging project exists | preview deploys | EAS development build | fictional only |
| Staging | separate Supabase project (to create) | `staging-admin.lurdy.eu` | TestFlight / Play internal | fictional only |
| Production | dedicated Supabase **Pro** project, PITR | `admin.lurdy.eu`, `app.lurdy.eu` | App Store / Google Play | real, after DPIA |

> Today the only project is `LurdyAPP`. It holds fictional development data. **Before real data**, either promote it to production (wipe dev data, re-apply migrations) and create a separate staging project, or the reverse. Decision recorded in STATUS (Q4).

## Database
1. Write migration → run `supabase/tests/run.sh` locally.
2. Apply to staging (`supabase db push` with the CLI linked to the project, or the Supabase MCP `apply_migration`). Project settings the code depends on are in `supabase/config.toml` (sign-ups off, TOTP on, JWT 900 s, `verify_jwt` per Edge Function: `code-login` off, `delete-account` on); Edge Functions deploy with `supabase functions deploy code-login delete-account`.
3. Run the SQL suite against staging; check Security Advisor. Compare `supabase/tests/run.sh fingerprint` (local) with the same query on the project: the two schemas must match.
4. The nightly log purge is a `pg_cron` job (`lurdy-purge-logs`, 03:15 UTC) created by the remediation migration when the extension is available; on a new project enable `pg_cron` first (Database → Extensions) or re-run that migration's last block. A super admin records the approved audit-log retention once with `select approve_log_retention(365);` — until then only sign-in attempts and stale badge prints are purged.
5. Apply to production in a quiet window; never edit an applied migration.

## Web (admin + app web)
Static builds (`vite build`, `expo export -p web`) deployed to Vercel as two projects separate from the public site. The app's web project must rewrite every path to `index.html` (`web.output: single`), or `/privacy` — the address given to the app stores — answers 404. GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit tests, lint, the admin build and the SQL suite on every push. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL` (the app's public address, used for the invitation links in the export; default `https://app.lurdy.eu`) (admin), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (app). Only the publishable key ever goes to a client. Security headers as on lurdy.eu (CSP allowing `connect-src` to the Supabase URL incl. `wss:`).

## Mobile
EAS Build (Expo account owned by the Grand Priory). iOS needs an Apple Developer Program membership (organisation account requires a D-U-N-S number); Android a Google Play developer account. Pilot via TestFlight and Play internal testing; production release after the pilot. Over-the-air updates (EAS Update) for JS-only fixes during the pilgrimage, on a channel tested on staging first.

## Pilot
A dry run with ~15 staff and fictional participants, ≥ 6 weeks before departure: print badges, run a mock bus boarding, move people, verify apps update; collect feedback; fix.

## Operations during the pilgrimage
- Printed fallback pack (manifests, room sheets, contact sheet) generated the evening before departure and each evening.
- One organiser on call for account issues (suspend/restore, MFA reset).
- Supabase status page and project logs watched by the super admin.

## Blockers needing the organisers
| Item | Who |
|---|---|
| Supabase Pro plan, billing | Grand Priory |
| Apple/Google developer accounts | Grand Priory |
| DNS for `admin.` / `app.lurdy.eu` | lurdy.eu domain owner |
| SMTP for invitations (e.g. Resend, already used by the site) | organisers |
| DPIA, privacy notice, consent text | controller |
