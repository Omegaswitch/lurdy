# I. Testing strategy

| Layer | Tool | What | Where it runs |
|---|---|---|---|
| Database / security | SQL scripts with assertions (`supabase/tests/*.sql`) | every RLS policy per role; RPC behaviour; triggers (capacity, version, edition consistency); medical access rules | local Postgres + `auth` shim (`supabase/tests/run.sh`); optionally hosted project inside `BEGIN … ROLLBACK` |
| Domain logic | Vitest (`platform/shared`) | badge imposition (mm → A4 grid), CSV parsing, duplicate detection, QR payload format, i18n key completeness | CI, local |
| Admin UI | Vitest + Testing Library for components with logic; Playwright for flows | sign-in, participant CRUD, assign, print views | Playwright against the dev Supabase project with fictional users |
| App | Playwright against the Expo web build; manual on devices | journey, scanner manual path, badge | CI (web), devices (native) |
| End-to-end | `platform/e2e` | the core scenario from the roadmap Phase 2 | dev project |
| Accessibility | `@axe-core/playwright` on every admin and app-web screen; manual checklist (keyboard only, screen reader, 200 % zoom, reduced motion, colour-blind simulation) | CI + before each release |
| Security | SQL policy tests; Supabase Security Advisor; `npm audit`; review of every `SECURITY DEFINER` function (search_path, grants) | each phase |
| Performance | `scripts/scan-latency` measures RPC round-trip p50/p95 over 100 scans; Realtime propagation time | before pilot, recorded in STATUS |
| Mobile | EAS development builds on one iOS and one Android device; camera scanning under low light; TalkBack/VoiceOver | before pilot |
| Backup/restore | restore the latest backup into a scratch project, run the SQL suite | before production, then yearly |

Rules:
- No real personal data in any test or fixture. Fixture names are obviously fictional.
- A feature is "done" only when its tests exist and pass; STATUS distinguishes *implemented & tested*, *implemented, not yet tested on device*, *simulated*, *not started*.
