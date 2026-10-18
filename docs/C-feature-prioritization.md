# C. Feature prioritisation

Scored on operational value (V), complexity (C), privacy risk (P): H/M/L. Ordering follows dependencies, not wishes.

## 1. Essential MVP — must exist before a pilot
| Feature | V | C | P | Note |
|---|---|---|---|---|
| Editions (create, activate) | H | L | L | |
| Staff accounts by invitation, roles per edition, MFA for privileged roles | H | M | H | foundation of everything |
| RLS on every table, tested before data | H | M | H | |
| Participants CRUD, search, filter, version-checked edit | H | M | M | |
| Transport legs + per-leg assignment + capacity/wheelchair check | H | M | L | |
| Accommodation: facilities, rooms, assignment, capacity | H | M | L | |
| Care assignments + coverage | H | M | M | |
| QR credential, badge print (mm, A4, crop marks), revoke/replace | H | M | L | |
| Staff scanner: lookup, board, arrive, manual search fallback | H | M | M | |
| Participant app: Home, Journey, Accommodation, Programme, Contacts, My ID | H | M | L | |
| Programme editor with audiences | H | L | L | |
| Contacts per edition | H | L | L | |
| Manifests and lists (print/PDF) with edition + timestamp | H | L | M | |
| Audit log of operational writes | H | L | L | |
| Realtime refresh of affected views | H | L | L | |

## 2. Operational release — needed for the real pilgrimage
| Feature | V | C | P | Note |
|---|---|---|---|---|
| Medical domain: records, medical grant, MFA step-up, audited RPC access | H | M | **H** | built only after its tests pass |
| Break-glass access | M | M | H | time-limited, justified, alerted |
| Incidents (operational + care, medical detail separated) | H | M | H | |
| CSV import with duplicate detection, CSV export (non-medical) | H | M | M | |
| Teams and duties, my duties, unfilled duty view | M | M | L | |
| Announcements, critical with acknowledgement | M | M | L | |
| Missing-person list per leg ("nobody left behind") | H | L | L | |
| Offline cache: participant views + staff manifest for a leg | H | M | M | limits in F §8 |
| Duplicate edition structure (no people) | H | L | L | |
| Guide pages and places (Lourdes guide) | M | L | L | content-heavy, not code-heavy |
| Push notifications (Expo push) | M | M | M | lock-screen-safe text only |

## 3. Advanced
| Feature | V | C | P | Note |
|---|---|---|---|---|
| Offline scanning with queued boarding, reconciliation | M | H | M | after online scanning is proven |
| Drag-and-drop board for buses and rooms | M | M | L | lists with "move to" come first |
| Shift handover notes | M | M | M | |
| Assistance requests from participants | M | M | M | needs staffing to answer |
| Anonymised statistics export | L | L | M | |
| Emergency assembly / roll-call workflow | M | M | L | reuses leg "missing" logic with a special leg |
| Participant self-verification of personal data | M | M | M | |

## 4. Optional future
| Feature | Why later |
|---|---|
| Interactive offline map tiles | licensing and size; static map + text directions first |
| Messaging with organisers | moderation and retention burden; phone works |
| Online application forms writing into the database | public site already e-mails forms; integrate once DPIA approved |
| Native wallet passes | nice, not needed |
| SSO for the Order's staff accounts | depends on Grand Priory IT |

## Rejected (bloat)
- In-app chat, social feeds, gamification, photo galleries in the app (the public site has the gallery).
- Live GPS tracking of participants — disproportionate under GDPR.
- Storing scanned ID documents/passports.
