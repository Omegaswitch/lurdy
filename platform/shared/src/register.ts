// The organisers' registration register, computed exactly as their Google Sheet ("Lourdes" workbook) does it:
// type codes, fees, the next letter due, the filtered lists, the bus lists and the overview counts. Pure functions,
// so the admin screens, the prints and the tests share one definition.
import type { Category } from './types';

export type TypeCode = 'P' | 'M' | 'T';
export const typeCode = (c: Category): TypeCode => (c === 'pilgrim' ? 'P' : c === 'malade' ? 'M' : 'T');

export interface RegPerson {
  id: string;
  first_name: string;
  last_name: string;
  category: Category;
  email: string | null;
  varsym: number | null;
  waiting: boolean;
  cancelled: boolean;
  confirmed: boolean;
  mail_sent: string | null;
  gender: string | null;
  birth_year: number | null;
  stays: string;
  is_nurse: boolean;
  is_doctor: boolean;
  is_priest: boolean;
  is_smom: boolean;
  is_lead: boolean;
  luggage_team: boolean;
  plane_to_accueil: boolean;
  truck_driver: boolean;
  no_flight: boolean;
}
export interface RegFees {
  fee_pilgrim: number; fee_team: number; fee_malade: number;
  fee_pilgrim_nf: number; fee_team_nf: number; fee_malade_nf: number;
}

// "Price for this participant": by type, lower without the flight; nothing for the waiting list or the cancelled
export function fee(p: RegPerson, e: RegFees): number {
  if (p.waiting || p.cancelled) return 0;
  const t = typeCode(p.category);
  if (p.no_flight) return t === 'P' ? e.fee_pilgrim_nf : t === 'T' ? e.fee_team_nf : e.fee_malade_nf;
  return t === 'P' ? e.fee_pilgrim : t === 'T' ? e.fee_team : e.fee_malade;
}

// the sheet's "valid mail?" check
export const validEmail = (e: string | null) => !!e && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());

// The letter due next, as the colour of the sheet's "mail sent" column: waiting-list letter (w), participation
// confirmation (x), payment confirmation (o); 'nomail' when there is no usable address; null when nothing is due.
export type Due = 'w' | 'x' | 'o' | 'nomail' | null;
export function nextLetter(p: RegPerson, paid: number, price: number): Due {
  if (p.cancelled) return null;
  if (!validEmail(p.email)) return 'nomail';
  if (p.waiting) return p.mail_sent === 'w' ? null : 'w';
  if (price > 0 && paid >= price) return p.mail_sent === 'o' ? null : 'o';
  return p.mail_sent === 'x' || p.mail_sent === 'o' ? null : 'x';
}

const active = (p: RegPerson) => !p.waiting && !p.cancelled;

// the sheet's tabs (Team, Malades, Malades Accueil, Pilgrims, Team < 35, Clergy, Waiting list, SMOM, Cancelled)
export type RegView = 'all' | 'team' | 'malades' | 'accueil' | 'pilgrims' | 'young' | 'clergy' | 'waiting' | 'smom' | 'cancelled';
export const regViews: { key: RegView; label: string }[] = [
  { key: 'all', label: 'Všichni' }, { key: 'team', label: 'Tým' }, { key: 'malades', label: 'Nemocní' },
  { key: 'accueil', label: 'Nemocní v Accueil' }, { key: 'pilgrims', label: 'Poutníci' }, { key: 'young', label: 'Tým < 35' },
  { key: 'clergy', label: 'Duchovní' }, { key: 'smom', label: 'SMOM' }, { key: 'waiting', label: 'Čekací listina' },
  { key: 'cancelled', label: 'Zrušení' },
];
export function inView(p: RegPerson, v: RegView, year: number): boolean {
  const t = typeCode(p.category);
  switch (v) {
    case 'all': return true;
    case 'team': return active(p) && t === 'T';
    case 'malades': return active(p) && t === 'M';
    case 'accueil': return active(p) && t === 'M' && p.stays === 'A';
    case 'pilgrims': return active(p) && t === 'P';
    case 'young': return active(p) && t === 'T' && p.birth_year != null && p.birth_year > year - 35;
    case 'clergy': return active(p) && p.is_priest;
    case 'smom': return !p.cancelled && p.is_smom;
    case 'waiting': return p.waiting && !p.cancelled;
    case 'cancelled': return p.cancelled;
  }
}

const byName = (a: RegPerson, b: RegPerson) =>
  `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'cs');
// first half / second half, the first half taking the extra one (the sheet's FLOOR(n/2)+1)
const halves = <T,>(xs: T[], extra = true): [T[], T[]] => {
  const n = xs.length ? Math.floor(xs.length / 2) + (extra ? 1 : 0) : 0;
  return [xs.slice(0, Math.min(n, xs.length)), xs.slice(Math.min(n, xs.length))];
};

// The sheet's bus lists: A and B to the hotel (pilgrims and malades staying at the hotel, split alphabetically, the
// luggage team split between them first), C to the Accueil (the rest of the team), D to the Accueil (malades in
// the Accueil and the "plane → Accueil" team), the truck. Nobody on the waiting list, cancelled or not flying.
export function busPlan<P extends RegPerson>(people: P[]) {
  const flying = people.filter((p) => active(p) && !p.no_flight);
  // the luggage team rides the hotel buses whatever else is ticked; nobody is seated twice
  const luggage = flying.filter((p) => p.luggage_team).sort(byName);
  const hotel = flying.filter((p) => !p.luggage_team && (typeCode(p.category) === 'P' || (typeCode(p.category) === 'M' && p.stays === 'H'))).sort(byName);
  const [hotelA, hotelB] = halves(hotel);
  const [luggageA, luggageB] = halves(luggage, false);
  return {
    A: [...luggageA, ...hotelA],
    B: [...luggageB, ...hotelB],
    C: flying.filter((p) => typeCode(p.category) === 'T' && !p.luggage_team && !p.plane_to_accueil && !p.truck_driver).sort(byName),
    D: [...flying.filter((p) => typeCode(p.category) === 'T' && p.plane_to_accueil && !p.luggage_team).sort(byName),
        ...flying.filter((p) => typeCode(p.category) === 'M' && p.stays === 'A').sort(byName)],
    truck: people.filter((p) => active(p) && p.truck_driver).sort(byName),
  };
}

// The sheet's Overview
export function overview(people: RegPerson[], paidOf: (p: RegPerson) => number, fees: RegFees, year: number) {
  const row = (t: TypeCode) => {
    const of = people.filter((p) => typeCode(p.category) === t);
    const due = (p: RegPerson) => nextLetter(p, paidOf(p), fee(p, fees));
    return {
      participants: of.filter(active).length,
      inPlane: of.filter((p) => active(p) && !p.no_flight).length,
      payConfirmed: of.filter((p) => !p.cancelled && p.mail_sent === 'o').length,
      partConfirmed: of.filter((p) => active(p) && p.confirmed).length,
      toBeSent: of.filter((p) => { const d = due(p); return d === 'w' || d === 'x' || d === 'o'; }).length,
      noMail: of.filter((p) => !p.cancelled && due(p) === 'nomail').length,
      waiting: of.filter((p) => p.waiting && !p.cancelled).length,
    };
  };
  const act = people.filter(active);
  // "caregiving team": team members minus leadership and priests
  const care = act.filter((p) => typeCode(p.category) === 'T' && !p.is_priest && !p.is_lead);
  const ages = (g: string) => care.filter((p) => p.gender === g && p.birth_year).map((p) => year - p.birth_year!);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const planned = act.reduce((s, p) => s + fee(p, fees), 0);
  // what counts towards the fees: active people only, each at most their own fee (an overpayment or a cancelled
  // person's money never hides someone else's debt)
  const paid = act.reduce((s, p) => s + Math.min(paidOf(p), fee(p, fees)), 0);
  return {
    team: row('T'), malades: row('M'), pilgrims: row('P'),
    smom: people.filter((p) => !p.cancelled && p.is_smom).length,
    waiting: people.filter((p) => p.waiting && !p.cancelled).length,
    cancelled: people.filter((p) => p.cancelled).length,
    nurses: act.filter((p) => p.is_nurse).length, doctors: act.filter((p) => p.is_doctor).length, priests: act.filter((p) => p.is_priest).length,
    hotel: act.filter((p) => p.stays === 'H').length, accueil: act.filter((p) => p.stays === 'A').length,
    teamHotel: act.filter((p) => typeCode(p.category) === 'T' && p.stays === 'H').length,
    teamAccueil: act.filter((p) => typeCode(p.category) === 'T' && p.stays === 'A').length,
    maladesHotel: act.filter((p) => typeCode(p.category) === 'M' && p.stays === 'H').length,
    maladesAccueil: act.filter((p) => typeCode(p.category) === 'M' && p.stays === 'A').length,
    ownWay: act.filter((p) => p.no_flight).length,
    caregivers: { men: care.filter((p) => p.gender === 'M').length, women: care.filter((p) => p.gender === 'F').length, menAge: avg(ages('M')), womenAge: avg(ages('F')),
                  total: care.length },
    money: { planned, paid, unpaid: Math.max(0, planned - paid),
             paidCount: act.filter((p) => { const f = fee(p, fees); return f > 0 && paidOf(p) >= f; }).length },
  };
}
