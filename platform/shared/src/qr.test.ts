import { expect, it } from 'vitest';
import { isBadgePayload, normaliseBadgePayload } from './qr';

it('accepts only our opaque badge format', () => {
  const ok = 'LRD1.' + '0123456789ABCDEF'.repeat(2);
  expect(isBadgePayload(ok)).toBe(true);
  expect(normaliseBadgePayload(' ' + ok.toLowerCase().replace('lrd1', 'LRD1') + '\n')).toBe(ok);
  expect(normaliseBadgePayload('https://example.com/' + ok)).toBeNull();
  expect(normaliseBadgePayload('LRD1.' + 'G'.repeat(32))).toBeNull();
  expect(normaliseBadgePayload('LRD1.' + 'A'.repeat(31))).toBeNull();
});
