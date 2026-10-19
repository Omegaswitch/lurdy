import { expect, it } from 'vitest';
import { friendlyError } from './errors';

it('explains capacity errors from the database triggers', () => {
  expect(friendlyError({ message: 'capacity:A is full (3 of 3)' })).toBe('Spoj A je plný (3 z 3 míst).');
  expect(friendlyError({ message: 'capacity:room 201 is full (2 of 2)' })).toBe('Pokoj 201 je plný (2 z 2 míst).');
  expect(friendlyError({ message: 'wheelchair:C has no free wheelchair place (2 of 2)' })).toContain('vozík');
  expect(friendlyError({ message: 'x', code: '42501' })).toBe('K této akci nemáte oprávnění.');
});
