// Turns database errors into sentences an organiser can act on.
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return '';
  const m = e.message ?? '';
  let x: RegExpMatchArray | null;
  if ((x = m.match(/^capacity:room (.+) is full \((\d+) of (\d+)\)/))) return `Pokoj ${x[1]} je plný (${x[2]} z ${x[3]} míst).`;
  if ((x = m.match(/^capacity:(.+) is full \((\d+) of (\d+)\)/))) return `Spoj ${x[1]} je plný (${x[2]} z ${x[3]} míst).`;
  if ((x = m.match(/^wheelchair:(.+) has no free wheelchair place \((\d+) of (\d+)\)/)))
    return `Ve spoji ${x[1]} už není volné místo pro vozík (${x[2]} z ${x[3]}).`;
  if (m.startsWith('care:')) return m.includes('malade') && m.includes('cannot') ? 'Nemocný nemůže být asistentem.' : 'Asistenci lze přidělit jen nemocnému.';
  if (e.code === 'NO_ROWS') return 'Změna se neuložila: záznam už neexistuje, nebo k němu nemáte oprávnění (vypršel kód pouti?).';
  if (e.code === '23505') return 'Tento záznam už existuje.';
  if (e.code === '42501') return 'K této akci nemáte oprávnění.';
  if (m.includes('Failed to fetch')) return 'Nejste připojeni k internetu. Změna se neuložila.';
  return 'Uložení se nepodařilo. Zkuste to znovu.';
}
