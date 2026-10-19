import { expect, it } from 'vitest';
import { fmtTime, fromLocalInput, toLocalInput } from './format';

it('shows and reads times in the edition time zone, across DST', () => {
  expect(fmtTime('2099-04-30T06:00:00Z', 'Europe/Paris')).toBe('08:00');
  expect(toLocalInput('2099-04-30T06:00:00Z', 'Europe/Paris')).toBe('2099-04-30T08:00');
  expect(fromLocalInput('2099-04-30T08:00', 'Europe/Paris')).toBe('2099-04-30T06:00:00.000Z');
  expect(fromLocalInput('2099-01-15T08:00', 'Europe/Paris')).toBe('2099-01-15T07:00:00.000Z');
  expect(fromLocalInput('', 'Europe/Paris')).toBeNull();
});
