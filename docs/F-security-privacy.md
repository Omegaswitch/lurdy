# F. Security and privacy architecture

> Technical controls do **not** make the platform GDPR-compliant by themselves. The legal and organisational items in §10 need decisions by the data controller before real personal data is entered.

## 1. Threat model (what we protect against)
| Threat | Example | Main controls |
|---|---|---|
| Curious insider | a volunteer browsing other people's health data | medical data unreachable except via audited functions; least-privilege roles |
| Lost/stolen phone | staff phone left on a bus | short sessions, app lock (biometric/PIN) for staff, no medical data cached, remote revocation |
| Lost badge | found in the street | QR holds only a random token; scanning needs a staff account |
| Leaked API key | publishable key in the app | that key grants nothing without a user JWT; RLS does the rest; service key never leaves the server |
| Bulk exfiltration | export of the whole database | exports of medical data not offered; list exports are organiser-only and logged |
| Account takeover | phished organiser password | MFA (TOTP) mandatory for organiser, medical and super admin |
| Mistakes | wrong person moved | versioned edits, audit log with before/after, confirmation on destructive actions |

## 2. Authentication
- Supabase Auth, e-mail + password (≥ 12 characters, leaked-password check on) or magic link for participants.
- **Public sign-up disabled.** Accounts are created by invitation from the admin dashboard (`invite` Edge Function using the service key server-side). An invited account has `profiles.status = 'invited'` and no rights until an organiser links it to a participant and/or grants a role.
- **MFA (TOTP)** for `super_admin`, `organizer`, `medical`. Enforced in the database: those grants only count when the JWT has `aal = aal2` (`app.has_role`). A privileged user without MFA can sign in but sees nothing privileged until enrolled.
- **Step-up for medical records**: `medical_*` functions additionally require a TOTP verification within the last **10 minutes** (from the JWT `amr` claim). The app asks for the 6-digit code (or, on phones, biometric unlock of the app followed by the code when the window has expired).
- Sessions: JWT expiry 15 min (configurable in Supabase), refresh tokens rotate; staff app locks after 5 min in background. Suspending a profile takes effect on the next request because every policy checks `profiles.status`.

## 3. Authorisation model
Two independent axes:
1. **Participant category** (staff / malade / assistant / pilgrim) — *who the person is in the pilgrimage*. Gives access only to one's own data.
2. **Application role per edition** — *what the account may do*:

| Capability | super admin | organizer | medical | staff | assistant | participant (self) |
|---|---|---|---|---|---|---|
| Manage editions, accounts, all roles | ✔ | — | — | — | — | — |
| Grant staff/assistant in own edition | ✔ | ✔ | — | — | — | — |
| CRUD participants and logistics | ✔ | ✔ | — | — | — | — |
| Read all participants (operational fields) | ✔ | ✔ | ✔ | ✔ | — | — |
| Read participants in own care | | | | | ✔ | — |
| Scan badges, board/arrive | ✔ | ✔ | ✔ | ✔ | — | — |
| Medical records (with MFA step-up) | — ¹ | — ¹ | ✔ | — | — | — |
| Carer-shareable care info | | | ✔ | | ✔ (own malades) | — |
| Break-glass (30 min, logged) | ✔ | ✔ | n/a | ✔ | — | — |
| Incidents: report | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Incidents: medical kind | — | ✔ summary only | ✔ | — | — | — |
| Audit log | ✔ | ✔ own edition | medical log | — | — | — |
| Own journey, room, programme, contacts | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

¹ Organisers and super admins do **not** see medical data by being administrators. If an organiser is also a physician, they get the `medical` grant explicitly.

Team leader is not a role: being "responsible" for a bus or a room is an assignment, shown in the staff app, on top of the `staff` role.

## 4. Medical data segregation
- Stored in schema `medical`, which is not exposed by the API. `anon` and `authenticated` have no privileges on it.
- Accessed only through `SECURITY DEFINER` functions with `search_path = ''`, each of which: checks the edition grant + `aal2` + step-up freshness (or an open break-glass session), writes `medical.access_log` (actor, participant, action, time, break-glass flag), and returns only the requested record.
- Medical fields never appear in: list views, CSV exports, print templates other than the restricted medical sheet, QR payloads, push notifications, offline caches, Realtime payloads (the medical tables are not in the Realtime publication), or logs (the audit trigger is not attached to medical tables; the access log stores no field values).
- Carers receive only fields a medical user marks *shareable with carers* (typically care instructions and allergies).

## 5. Break-glass
For a real emergency when no medical user is reachable: a staff member with MFA opens `break_glass_open(participant, reason)`; reason is mandatory (≥ 10 characters). Grants read-only access to that one record for 30 minutes. It is logged, creates a high-severity incident visible to organisers and medical leads, and appears in the medical access report for review after the event.

## 6. Data minimisation decisions
- No date of birth, national ID, passport or insurance numbers in the core model. (If the airline or insurer needs them, they are collected outside the platform.)
- `mobility` (walks / assisted / wheelchair) is the only health-derived flag in the operational domain, because buses need wheelchair places. It is visible to staff, not to other participants.
- Category *malade* is health-revealing: participant-facing views never list other participants; badges do not print the category by default (open question Q3).
- Roommates are not shown to participants.
- Photos optional, staff-visible only, stored in a private bucket.

## 7. QR credential
Random 128-bit token, stored as SHA-256 hash; QR text `LRD1.<token>`. A scan by someone without a staff grant in that edition returns `not_authorized` and no data. Lost badge → revoke → new token → reprint; the old badge then scans as *revoked*.

## 8. Offline
| Device | Cached | Never cached |
|---|---|---|
| Participant | own `my_pilgrimage` JSON (journey, room, programme, contacts, announcements), with "as of" time | other people |
| Staff | for one chosen leg: names, categories, token hashes, assignment state (Advanced phase) | medical data, emergency contacts of others |
Cache is cleared on sign-out and when the account is suspended (on the next successful request). Offline boarding scans are queued with `client_scan_id`, replayed idempotently; a revoked badge is only detected once online — documented limitation.

## 9. Retention (proposal — needs controller approval)
| Data | Kept until |
|---|---|
| Medical records | **30 days after the edition ends**, then deleted automatically (`medical.purge_expired()`), unless tied to an open incident |
| Medical access log | 2 years (accountability) |
| Participants and assignments | 12 months after the edition ends, then deleted; anonymised counts kept |
| Scans | 3 months after the edition ends |
| Audit log | 12 months; `old/new` JSON of deleted participants purged with them |
| Accounts | while active in a current or next edition; inactive > 24 months → deleted |
Backups (Supabase daily, 7–30 days) age out on their own schedule; deletion from backups happens when they expire — this is stated in the privacy notice.

## 10. GDPR — what needs organisational decisions
- **Controller**: likely the Foundation that already handles applications (*Maltézský nadační fond LOURDES*) and/or the Grand Priory. Must be fixed in writing (Q2).
- **Lawful basis**: Art. 6(1)(b) (taking part in the pilgrimage) for ordinary data; for **health data** Art. 9(2)(a) **explicit consent** collected on the application, with 9(2)(c) (vital interests) for emergencies when the person cannot consent. Religious-belief inference: Art. 9(2)(d) (not-for-profit body with a religious aim, data of persons in regular contact, not disclosed outside without consent).
- **DPIA: required.** Special-category data of vulnerable people (elderly, sick) processed with a new system meets several EDPB/WP248 criteria and the Czech ÚOOÚ list. A DPIA template outline is in [security/dpia-outline.md](security/dpia-outline.md).
- **Processors**: Supabase (DPA, EU hosting, SCC/DPF for the US parent), Vercel (static hosting, no personal data), Expo/Apple/Google for push (content kept non-personal). Records of processing (Art. 30) updated.
- **Rights**: access/rectification/erasure handled by organisers via the admin dashboard; export of a person's own data is an Advanced feature.
- **Staff confidentiality**: every volunteer with an account signs a confidentiality undertaking; medical users are bound by professional secrecy.
- **Breach procedure**: 72-hour notification to ÚOOÚ; the audit and access logs support investigation.

## 11. Platform hardening checklist (before real data)
- [ ] Supabase Pro plan, PITR enabled, backups verified by a restore test
- [ ] Sign-ups disabled; e-mail confirmations on; custom SMTP for invitations
- [ ] MFA (TOTP) enabled in Auth settings
- [ ] JWT expiry 900 s; leaked-password protection on
- [ ] Security Advisor clean (RLS on all tables, `search_path` set on functions)
- [ ] Network restrictions for direct DB connections
- [ ] Service-role key only in Edge Function secrets
- [ ] Separate staging project with fictional data only
