// Times are shown in the pilgrimage's own time zone (the edition's), whatever the organiser's computer uses.
export const fmtTime = (iso: string | null, tz: string) =>
  iso ? new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';
export const fmtDay = (iso: string | null, tz: string) =>
  iso ? new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(iso)) : '';
export const fmtStamp = (d: Date) =>
  new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
export const fullName = (p: { title?: string | null; first_name: string; last_name: string }) =>
  [p.title, p.first_name, p.last_name].filter(Boolean).join(' ');

// <input type="datetime-local"> value ↔ ISO, interpreted in the edition's time zone.
export function toLocalInput(iso: string | null, tz: string): string {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}
export function fromLocalInput(value: string, tz: string): string | null {
  if (!value) return null;
  // Find the UTC instant whose wall-clock time in tz equals `value` (two passes handle DST offsets).
  let guess = new Date(value + 'Z').getTime();
  for (let i = 0; i < 2; i++) {
    const shown = new Date(toLocalInput(new Date(guess).toISOString(), tz) + 'Z').getTime();
    guess += new Date(value + 'Z').getTime() - shown;
  }
  return new Date(guess).toISOString();
}
