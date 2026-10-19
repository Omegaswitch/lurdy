# A. Legacy workflow analysis

Source: the six 2026 documents supplied by the organisers. They were read to learn **what kinds of data, relationships, outputs and workflows** the platform must support. No name, phone number, room, flight or other record from them is copied into this repository, its fixtures or its tests. Everything below is described by role or by structure.

| # | Document | What it is |
|---|---|---|
| 1 | `Program Lurdy 2026.pdf` (28 pp.) | Brochure for pilgrims and the sick: two-column daily programme, accommodation, key contacts, chaplain's welcome, history of Lourdes and the apparitions, sights, Mass texts (Czech/Latin), hymns, map of the sanctuary |
| 2 | `Program Lurdy Tým 2026.pdf` (20 pp.) | Same programme for the team, plus duty rosters, airport and bus plans, team groups, night shifts, meal shifts, room list with responsible team members, work instructions, nursing guidance (pressure sores), cleaning team, map |
| 3 | `seznam týmu - alfabeticky.docx` | Alphabetical team list: surname, first name |
| 4 | `Jmenovky poutnici.pdf` (11 pp.) | Name badges, 10 per A4 sheet (2 × 5, ≈ 90 × 55 mm): Order shield, "PÈLERINAGE MALTE TCHÈQUE", name, accommodation label, one contact person + phone |
| 5 | `Acceuil 2026.docx` | Room table for the care facility: room number/capacity ("211/6"), sick residents, team members lodged in the room, team member on duty for the room |
| 6 | `Team + nemocní.docx` | Sick person → assigned carer(s); carer may be a team member, a relative ("husband", "daughter"), or a group ("Team Hotel") |

## Observed workflows and their digital replacement

### 1. Programme and daily schedule (docs 1, 2)
**Today.** A Word/PDF brochure, two columns per time slot: *Sick and team* and *Pilgrims*; some rows are team-only (wake-up, morning prayer, team breakfast), some shared (Mass, processions). Changes after printing ("place to be confirmed depending on weather") are passed on by word of mouth.
**Platform.** `events` with an **audience** (categories) and a location. The participant app shows only the rows for the person's category, in their language; edits push live with a "changed" marker. The print view reproduces the two-column brochure table with edition and timestamp. Devotional content (Mass texts, hymns, history) becomes **guide pages** — reusable across years, edited separately from the schedule.

### 2. Different instructions for pilgrims and team (docs 1 vs 2)
**Today.** Two brochures, the team one with 8 extra pages.
**Platform.** One content set, filtered by role: team instructions are guide pages with audience `staff`/`assistant`. Nursing guidance stays a staff-only guide page (general knowledge, not personal data).

### 3. Team roster and responsibilities (docs 2, 3)
**Today.** Alphabetical list; coordination team; medical, spiritual leads; named "responsible" person per task (luggage, check-in, buses, supplies, wheelchairs, rickshaws, baths, cleaning); Team 1 / Team 2 groups for meal service; "Team Hotel".
**Platform.** Participants of category *staff*/*assistant*; **teams** (Team 1, Team Hotel, cleaning team, luggage team) with members; **duties** (time-boxed tasks with a lead and assignees). The roster print is generated: alphabetical, by team, by duty.

### 4. Sick person ↔ carer assignment (docs 5, 6, 2)
**Today.** A two-column table. A carer may be a team member, a relative travelling as pilgrim, or a whole group. During airport operations carers are temporarily swapped because they work registration/check-in. Night duty swaps carers the next morning ("A covers for B").
**Platform.** `care_assignments`: sick person, carer, kind (*primary / backup / temporary*), optional period. Swaps become temporary assignments with a period, so the system knows who is responsible *now*. Coverage view flags sick people without an active primary carer. Relatives travelling with a sick person are ordinary participants who can be carers.

### 5. Accommodation and rooms (docs 1, 2, 5)
**Today.** Two facilities: a pilgrims' hotel and the Accueil Notre-Dame care facility (zone, floor). Room code = number/capacity. Rooms mix sick people and team members; a team member may be lodged in one room and on duty for another. Some team members live in the hotel and work in the Accueil.
**Platform.** `facilities → rooms(capacity) → room_assignments`. "Responsible for room" is a separate relation (`rooms.responsible_participant_id`) from "lodged in room". Capacity is enforced; the room sheet print reproduces the Accueil table.

### 6. Airport and bus coordination (doc 2)
**Today.** Charter flight out and back (flight number, times, airports). At departure airport: registration desk, luggage team, first and last to check in. At arrival: luggage team first off, buses A–D by destination (hotel pilgrims, hotel pilgrims, Accueil team, Accueil sick — "Hospitalité" bus), a luggage truck; one responsible person per bus; the pilgrimage head leaves the hall last after checking nobody is left. Same plan reversed for return.
**Platform.** `transport_legs` (flight, bus, truck) with direction (*outbound / return / local*), capacity, wheelchair places, responsible person; `leg_assignments` per participant per leg, with status *assigned → boarded → arrived / missing*. Scanning a badge at the bus door boards the person. The "nobody left behind" check becomes the **missing list** for a leg: assigned but not boarded.

### 7. Passenger grouping and luggage (docs 2, 4)
**Today.** Luggage sorted by the colour of the name tag (hotel vs Accueil); wheelchair users get a name label on the chair and its parts.
**Platform.** The badge colour band and printed label come from the participant's facility. Luggage/wheelchair labels are a print template with the same opaque QR as the badge.

### 8. Emergency contacts and logistics (docs 1, 2)
**Today.** A "key contacts" box: head of pilgrimage, chaplains, doctors per facility, with mobile numbers. Badges carry one contact person + phone.
**Platform.** `contacts` per edition with audience; the app's Help screen is one tap from Home and works offline from cache. The badge prints the edition's **public** emergency number only.

### 9. Printed identification badges (doc 4)
**Today.** Word mail-merge, 2 × 5 per A4, no QR.
**Platform.** Badge generator with millimetre-exact size, A4 imposition, crop marks, alignment offset, single/batch/reprint; QR holds an opaque token only; revoke/replace on loss. Printed text is a snapshot; the scan always shows the live record.

### 10. Night shifts, meal service, cleaning (doc 2)
**Today.** Tables per day: night pair, morning carer swaps, team meal shifts, cleaning team on departure day.
**Platform.** Duties with time windows and assignees; "my duties" in the staff app; unfilled-duty view in admin.

### 11. Team meals and vouchers (doc 2)
**Today.** Instructions in the brochure.
**Platform.** Guide page (no feature). Voucher handling is out of scope.

## Data categories discovered

| Domain | Examples | Sensitivity |
|---|---|---|
| Identity | name, title (P., Sr., MUDr.), preferred name, category | personal |
| Contact | phone, e-mail, emergency contact | personal |
| Travel | flight, bus per leg, boarding status | personal |
| Accommodation | facility, room, bed | personal |
| Care relationships | sick person ↔ carer | **health-revealing** (being "sick" is itself health data) |
| Mobility needs | wheelchair, rickshaw, stretcher | **health-revealing** |
| Medical | conditions, medication, allergies, care instructions | **Art. 9 special category** |
| Spiritual | role as chaplain | may reveal religious belief (Art. 9) — see F |

Two findings shape the security model:
1. **The participant category "malade" is itself health data.** Lists that show who is sick must be staff-only; the public badge must not reveal it by text (see F §6 and the badge decision in D).
2. **Participation in a Catholic pilgrimage reveals religious belief** (Art. 9). The whole participant database is special-category data, not only the medical module.

## Gaps and risks in the paper process
- No single source of truth: the same room appears in three documents and can disagree.
- Printed copies outlive changes; nothing on paper says which version it is.
- Health information travels in Word files by e-mail.
- No record of who boarded which bus, beyond a head count.
- Carer swaps are implicit; nobody can answer "who is responsible for X right now?".
