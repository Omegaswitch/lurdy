import { expect, test } from '@playwright/test';
import { totp } from './helpers';

test('TOTP helper matches the RFC 6238 test vector', () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (base32 below), T = 59 s → 94287082 (last 6 digits).
  expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toBe('287082');
});
