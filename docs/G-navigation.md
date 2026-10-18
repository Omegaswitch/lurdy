# G. Application navigation

The app adapts to the signed-in account: what you see is the union of *your own participation* and *your roles*. Nothing is hidden behind a menu the user cannot open — screens they may not use are simply absent.

## Mobile / web app (`platform/app`, Expo)

**No tab bar, no small menus** (organisers' decision, ADR-12). One home screen with full-width buttons (≥ 64 pt, icon + word); every screen does one thing and has a big *Zpět* (back) in the red header. Text is large and follows the phone's text size, plus an in-app *Větší písmo* switch.

Sign-in: one screen — 4-digit code; *Jsem člen týmu* reveals the event-code field.

### Home — everyone
1. Greeting + edition; critical announcements with *Přečetl(a) jsem*.
2. **Další na programu** — the next item for me (time in large type, place).
3. Buttons: **Moje cesta** · **Program** · **Ubytování** · **Mapa Lurd** · **Můj kód** · **Pomoc a kontakty** (red) · *Větší písmo* · *Odhlásit*.

| Screen | Content |
|---|---|
| Moje cesta | each leg (outbound / local / return): flight or bus code in large type, route, departure, meeting point, who is in charge, "boarded" when scanned |
| Program | day chips → items for my category, *Změněno* marker, *Ukázat na mapě* when the item has a place |
| Ubytování | facility, address, room number in large type, floor/zone, link to the map |
| Mapa Lurd | OpenStreetMap street map with labelled pins (sanctuary places + my accommodation); *Zapnout moji polohu* (on request, stays on the phone); selected place card with description and **Navigovat** (opens the phone's maps app, walking); the same places as a list of big buttons below the map |
| Můj kód | name + personal QR (a digital credential that only this phone holds) |
| Pomoc a kontakty | 112, the pilgrimage emergency line, my assistants, the edition's contacts — each a one-tap call |

### Team additions (any role)
- **Skenovat** (red, at the top of Home): choose what you are doing once (*Jen zjistit / Nástup / Příjezd / Ubytování*, and for boarding/arrival which bus or flight), then scan. Result fills the screen: verdict in words with icon and colour (*V pořádku / Jiný autobus! + where they belong / Neplatná jmenovka*), then name, category, room, all legs with boarding state, assistant, logistics note, emergency contact; big **Další**. Fallbacks on the same screen: type/paste the badge text (or use a keyboard-style hardware scanner) and search by name or 4-digit code.
- **Moje služba**: buses I am responsible for with *N / M nastoupilo* and the **missing list**; the sick people in my care (incl. temporary cover with end time); my duties.
- **Nahlásit problém**: what is happening (missing person, care, health, organisation, other), short description (reminder: no diagnoses), *naléhavé*, send.

Carers without a team role see *Moje služba* when someone is in their care.

### Medical (planned, Phase 7)
*Zdravotní* button for the medical role, MFA step-up before each record.

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
