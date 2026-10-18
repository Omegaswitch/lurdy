// QR text on badges: 'LRD1.' + 32 hex characters. Opaque; never contains personal data.
const PATTERN = /^LRD1\.[0-9A-F]{32}$/;

export const isBadgePayload = (text: string): boolean => PATTERN.test(text.trim().toUpperCase());

// Normalises what a camera or keyboard-wedge scanner delivers; null if it is not one of ours.
export function normaliseBadgePayload(text: string): string | null {
  const t = text.trim().toUpperCase();
  return PATTERN.test(t) ? t : null;
}
