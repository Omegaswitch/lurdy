# G. Application navigation

The app adapts to the signed-in account: what you see is the union of *your own participation* and *your roles*. Nothing is hidden behind a menu the user cannot open — screens they may not use are simply absent.

## Mobile / web app (`platform/app`, Expo)

Bottom tab bar, max. 5 tabs, icon **and** text label, 56 px+ targets.

### Participant (pilgrim, malade, and everyone else for their own data)
| Tab | Screen | Content |
|---|---|---|
| **Domů** (Home) | Home | edition name and dates; *Next*: the next programme item for me; critical announcements (with "I have read this"); big **Help** button → Contacts |
| **Cesta** (Journey) | My journey | outbound flight, meeting point/time, bus per leg; return the same; changes highlighted |
| **Program** | Daily programme | day tabs, my category's items; changed items marked; tap → place + directions text |
| **Ubytování** | My accommodation | facility, address, map link, room, instructions |
| **Více** (More) | More | **My badge** (QR, name, facility), Lourdes guide, Contacts & help, Settings (language, text size, sign out) |

### Staff additions (role staff/organizer/medical)
- A **Skenovat** (Scan) tab replaces *Ubytování* in the bar (accommodation moves under More). Scan → full-screen result card: name, photo, category, facility/room, leg for the chosen context with large status (✔ BOARDED / ⚠ OTHER BUS / ✖ REVOKED), one big action button (*Board*, *Arrived*, *Checked in*), auto-ready for the next scan. Context selector (which leg / registration) at the top. Manual search fallback.
- **Moje služba** (My duty) under Home: my duties today, buses/rooms I'm responsible for with counts (e.g. *Bus C 27/30 boarded — 3 missing*), people in my care.
- **Hlásit problém** (Report a problem): incident form (kind, severity, person optional, short summary — with a reminder not to type medical details).

### Assistant / carer
- *Moje služba* shows the sick people in my care now (primary, backup, temporary cover), their room, carer-shareable care info (after tapping, logged).

### Medical
- **Zdravotní** (Medical) under More: list of my edition's sick participants → record (MFA step-up prompt if the 10-minute window has expired) → view/edit; medical incidents.

## Admin dashboard (`platform/admin`, desktop web)

Left sidebar, grouped. The active edition is chosen at the top and shown on every screen and printout.

| Group | Screens |
|---|---|
| Overview | **Přehled** (dashboard): counts by category, unassigned to bus/room, care coverage gaps, boarded/arrived per leg, open incidents, unfilled duties |
| People | **Účastníci** (directory: search, filter by category/bus/room/team, bulk actions, import/export), participant detail (tabs: profile, emergency contacts, journey, room, care, badge, history) |
| | **Účty a role** (accounts, invitations, role grants, MFA state) |
| Logistics | **Doprava** (legs; per-leg list with capacity bar, wheelchair places, move-to, manifest) |
| | **Ubytování** (facilities → rooms; occupancy, move-to, room sheet) |
| | **Péče** (care assignments; coverage matrix; reassign) |
| | **Týmy a služby** (teams, duties, unfilled) |
| Programme | **Program** (events by day, audiences), **Kontakty**, **Oznámení**, **Průvodce** (guide pages, places) |
| Field | **Odbavení** (live boarding/attendance per leg, missing list), **Incidenty** |
| Print | **Tisk**: badges (layout editor with mm sizes, preview, A4 sheet, crop marks, offset), manifests, room sheets, rosters, programme, contacts |
| Restricted | **Zdravotní** (medical users only), **Audit** (organisers/super admin) |
| Settings | **Ročník** (edition settings, duplicate edition, archive) |

Every print view header/footer: *Pouť do Lurd {year} · {title} · vytištěno {date time} · strana n/N*.
