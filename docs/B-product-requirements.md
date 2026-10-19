# B. Product requirements

## Purpose
One secure system of record for the annual pilgrimage of the Czech Grand Priory of the Order of Malta to Lourdes, from 2027 onwards. It replaces the Word/PDF/e-mail workflow described in [A](A-legacy-workflow-analysis.md) and stays useful in the field: at an airport, at a bus door, in a corridor of the Accueil, with weak signal and tired people.

Non-goals: payments, fundraising, flight booking, public marketing (the public site lurdy.eu stays as it is), general chat.

## Personas

| Persona | Context | Needs most |
|---|---|---|
| **Organiser** (2–4 people) | Laptop, months before and during the pilgrimage | Register people, assign buses/rooms/carers, print, see gaps |
| **Medical lead / nurse** | Laptop before, phone during | See care needs of the sick they treat, update notes, handle incidents |
| **Team leader / staff** (≈ 50) | Phone, standing, often outdoors | Scan badge → see bus/room → board; my duties; report an issue |
| **Assistant / carer** | Phone | Whom am I responsible for now, where are they, what must I know |
| **Malade** (sick pilgrim, often elderly, limited mobility or sight) | Own phone, a relative's phone, or **no phone at all** | Paper badge works without anything else; if app: next event, my room, help |
| **Pilgrim** (≈ 50–60, many over 65) | Own phone | Programme, my bus, my hotel room, who to call |
| **Super administrator** | Laptop | Accounts, roles, edition set-up, audit |

A participant may have no account at all. The system must fully work for people who only have a paper badge.

## Core use cases
1. **Prepare an edition**: create 2028 from the 2027 structure (programme template, facilities, rooms, legs, teams, contacts) without people or health data.
2. **Register participants**: manual entry, or CSV import with duplicate detection and per-row reconciliation.
3. **Assign logistics**: flight and buses per leg, room, carers, teams, duties; see conflicts immediately.
4. **Print**: badges, bus/flight manifests, room sheets, rosters, programme, contact sheet; each stamped with edition and time.
5. **Operate on the day**: scan badge at registration/bus door, record boarding/arrival, see who is missing.
6. **Change during the pilgrimage**: move someone to another bus; the next scan and their app show it.
7. **Care**: carers see their assigned sick people; medical staff with step-up authentication see medical records; every access is logged.
8. **Communicate**: announcements to a category, critical ones with read acknowledgement; programme changes visible in the app.
9. **Report an incident**: anyone on staff reports; medical incidents route to medical staff without exposing details to others.
10. **Close the edition**: archive, export anonymised statistics, delete personal data on schedule.

## Functional requirements (summary — detailed per module in [E](E-database.md) and [G](G-navigation.md))
- **FR-ED** Editions: create, duplicate structure, activate, archive; exactly one active edition shown to participants by default.
- **FR-PA** Participants: CRUD, category, contact, language, emergency contacts, logistics flags, notes, photo; search, filter, bulk edit; CSV import/export with duplicate check; version-checked edits.
- **FR-AC** Accounts & roles: invite by e-mail, approve, link to participant, grant/revoke roles per edition, enforce MFA for privileged roles, immediate revocation.
- **FR-TR** Transport: legs (flight/bus/truck) per direction, capacity and wheelchair places, responsible person, assignments per leg, drag-and-drop move, overbooking prevented, manifests, boarding status.
- **FR-AM** Accommodation: facilities, rooms with capacity, room responsible, assignments, move, occupancy, room sheet.
- **FR-CA** Care: carer assignments (primary/backup/temporary, period), coverage, conflicts, quick reassign, carer dashboard, notifications.
- **FR-DU** Teams & duties: groups, duties with time window, assignees, unfilled alert.
- **FR-QR** Credentials: opaque token per participant, badge print (mm), revoke/replace, scan lookup, check-in/boarding.
- **FR-PR** Programme & guide: events with audience, guide pages, places, contacts.
- **FR-NO** Announcements & push: audience, priority, acknowledgement; lock-screen-safe wording.
- **FR-IN** Incidents: report, route, assign, resolve; medical detail separated.
- **FR-ME** Medical: separate domain, access only via audited functions with medical grant + MFA step-up; break-glass.
- **FR-AU** Audit: every write to operational data; every read/write of medical data; viewable by authorised roles.
- **FR-PRN** Printing: templates for all outputs listed in the brief, A4 and badge sizes, timestamp + edition on every page.

## Non-functional requirements

| ID | Requirement | Target / measure |
|---|---|---|
| NFR-1 Security | Server-side authorisation on every row (RLS) and every privileged function | RLS test suite passes; no table without RLS |
| NFR-2 Privacy | Data minimisation; no medical data in lists, QR, notifications, offline caches | Reviewed in F; tested |
| NFR-3 Scan speed | Scan → result on screen | < 2 s p95 on 4G; measured, see [I](I-testing.md) |
| NFR-4 Realtime | Admin change visible on connected clients | < 5 s typical |
| NFR-5 Availability | Hosted on managed EU infrastructure; paper fallback always printable | Daily backups, PITR recommended |
| NFR-6 Accessibility | Web WCAG 2.2 AA; mobile platform equivalents | axe in CI + manual checklist |
| NFR-7 Language | Czech primary; English, French ready; strings externalised | No hard-coded UI text in components |
| NFR-8 Offline | Participant app readable offline from last sync, with "as of" time | Cached views labelled |
| NFR-9 Maintainability | Small TypeScript codebase, one database, migrations in git | New organiser can set up an edition from the guide |
| NFR-10 Cost | Fits Supabase Pro + free/low tiers of hosting | < ≈ €50/month outside pilgrimage month |
| NFR-11 Year independence | No year-specific data in code | Lint/grep check: no `2026`/`2027` literals outside tests and docs |
