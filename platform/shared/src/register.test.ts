import { describe, expect, it } from 'vitest';
import { busPlan, fee, inView, nextLetter, overview, typeCode, type RegFees, type RegPerson } from './register';

const fees: RegFees = { fee_pilgrim: 18000, fee_team: 18000, fee_malade: 18000, fee_pilgrim_nf: 10000, fee_team_nf: 10000, fee_malade_nf: 10000 };
let n = 0;
const person = (o: Partial<RegPerson>): RegPerson => ({
  id: String(++n), first_name: 'Test', last_name: `Osoba${String(n).padStart(3, '0')}`, category: 'pilgrim', email: 'a@example.test',
  varsym: 400 + n, waiting: false, cancelled: false, confirmed: false, mail_sent: null, gender: 'F', birth_year: 1960, stays: 'H',
  is_nurse: false, is_doctor: false, is_priest: false, is_smom: false, is_lead: false, luggage_team: false, plane_to_accueil: false,
  truck_driver: false, no_flight: false, ...o,
});

describe('register (the organisers\' sheet)', () => {
  it('type codes P / M / T (staff and assistants are the team)', () => {
    expect(['pilgrim', 'malade', 'staff', 'assistant'].map((c) => typeCode(c as RegPerson['category']))).toEqual(['P', 'M', 'T', 'T']);
  });
  it('fee by type, lower without the flight, nothing for waiting list or cancelled', () => {
    expect(fee(person({}), fees)).toBe(18000);
    expect(fee(person({ no_flight: true }), fees)).toBe(10000);
    expect(fee(person({ waiting: true }), fees)).toBe(0);
    expect(fee(person({ cancelled: true }), fees)).toBe(0);
  });
  it('next letter: waiting list (w), confirmation (x), payment (o), no address', () => {
    expect(nextLetter(person({ waiting: true }), 0, 0)).toBe('w');
    expect(nextLetter(person({ waiting: true, mail_sent: 'w' }), 0, 0)).toBe(null);
    expect(nextLetter(person({ waiting: true, mail_sent: 'x' }), 0, 0)).toBe('w'); // moved to the waiting list after a confirmation
    expect(nextLetter(person({}), 0, 18000)).toBe('x');
    expect(nextLetter(person({ mail_sent: 'x' }), 0, 18000)).toBe(null);
    expect(nextLetter(person({ mail_sent: 'x' }), 18000, 18000)).toBe('o');      // "a blue x on green: next time, a payment confirmation"
    expect(nextLetter(person({ mail_sent: 'o' }), 18000, 18000)).toBe(null);
    expect(nextLetter(person({ email: 'not an address' }), 0, 18000)).toBe('nomail');
    expect(nextLetter(person({ cancelled: true }), 0, 0)).toBe(null);
  });
  it('the sheet\'s tabs', () => {
    const t = person({ category: 'assistant', birth_year: 1995 });
    const ma = person({ category: 'malade', stays: 'A' });
    expect(inView(t, 'team', 2026) && inView(t, 'young', 2026)).toBe(true);
    expect(inView(person({ category: 'assistant', birth_year: 1991 }), 'young', 2026)).toBe(false);
    expect(inView(ma, 'accueil', 2026) && inView(ma, 'malades', 2026) && !inView(ma, 'pilgrims', 2026)).toBe(true);
    expect(inView(person({ waiting: true }), 'pilgrims', 2026)).toBe(false);
    expect(inView(person({ waiting: true }), 'waiting', 2026)).toBe(true);
    expect(inView(person({ cancelled: true, waiting: true }), 'waiting', 2026)).toBe(false);
    expect(inView(person({ is_priest: true, category: 'staff' }), 'clergy', 2026)).toBe(true);
  });
  it('bus lists by the sheet\'s rules', () => {
    const pilgrims = Array.from({ length: 5 }, () => person({}));
    const mh = person({ category: 'malade', stays: 'H' });
    const ma = person({ category: 'malade', stays: 'A' });
    const lug = [person({ category: 'assistant', luggage_team: true }), person({ category: 'assistant', luggage_team: true })];
    const toA = person({ category: 'assistant', plane_to_accueil: true });
    const team = person({ category: 'assistant' });
    const truck = person({ category: 'assistant', truck_driver: true });
    const own = person({ no_flight: true });
    const out = person({ waiting: true });
    const b = busPlan([...pilgrims, mh, ma, ...lug, toA, team, truck, own, out]);
    expect(b.A.length + b.B.length).toBe(8); // 5 pilgrims + 1 malade at the hotel + 2 luggage team
    expect(b.A.slice(0, 1)).toEqual([lug[0]]);
    expect(b.B.slice(0, 1)).toEqual([lug[1]]);
    expect(b.A.length - 1).toBe(4); // hotel people split FLOOR(6/2)+1 = 4 / 2
    expect(b.C).toEqual([team]);
    expect(b.D).toEqual([toA, ma]);
    expect(b.truck).toEqual([truck]);
    for (const list of Object.values(b)) expect(list).not.toContain(own), expect(list).not.toContain(out);
    // nobody twice: a pilgrim on the luggage team and a team member with both flags
    const twice = busPlan([person({ luggage_team: true }), person({ category: 'assistant', luggage_team: true, plane_to_accueil: true }), ma]);
    const all = Object.values(twice).flat();
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });
  it('overview: counts, caregivers by gender and age, money', () => {
    const ps = [
      person({ category: 'assistant', gender: 'M', birth_year: 1980, mail_sent: 'o' }),
      person({ category: 'assistant', gender: 'F', birth_year: 1990, confirmed: true }),
      person({ category: 'assistant', is_priest: true, gender: 'M' }),
      person({ category: 'assistant', gender: 'F', birth_year: null }), // added by hand, no birth year yet
      person({ category: 'malade', stays: 'A' }),
      person({ waiting: true }),
      person({ cancelled: true }),
    ];
    const o = overview(ps, (p) => (p === ps[0] ? 18000 : p === ps[5] ? 18000 : 0), fees, 2026); // ps[5] is cancelled and had paid
    expect(o.team.participants).toBe(4);
    expect(o.caregivers).toMatchObject({ men: 1, women: 2, menAge: 46, womenAge: 36, total: 3 });
    expect(o.priests).toBe(1);
    expect(o.waiting).toBe(1);
    expect(o.cancelled).toBe(1);
    expect(o.maladesAccueil).toBe(1);
    expect(o.money).toEqual({ planned: 5 * 18000, paid: 18000, unpaid: 4 * 18000, paidCount: 1 }); // the cancelled person's money covers nobody
    expect(o.team.payConfirmed).toBe(1);
    expect(o.team.partConfirmed).toBe(1);
  });
});
