import { describe, expect, it } from 'vitest';
import { A4, defaultBadgeConfig, impose, paginate, validateBadgeConfig } from './badge';

describe('impose', () => {
  it('fits the default 90×55 mm card 2×4 on A4 with margins and gaps', () => {
    const i = impose(defaultBadgeConfig);
    expect([i.columns, i.rows, i.perSheet]).toEqual([2, 4, 8]);
  });

  it('reproduces the 2026 layout (2×5, no margin, no gap) exactly', () => {
    const i = impose({ ...defaultBadgeConfig, widthMm: 105, heightMm: 59.4, marginMm: 0, gapMm: 0 });
    expect(i.perSheet).toBe(10);
    expect(i.slots[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(i.slots[9]!.xMm).toBeCloseTo(105);
    expect(i.slots[9]!.yMm).toBeCloseTo(4 * 59.4);
  });

  it('centres the grid and keeps every card inside the sheet margins', () => {
    const c = defaultBadgeConfig;
    for (const s of impose(c).slots) {
      expect(s.xMm).toBeGreaterThanOrEqual(c.marginMm);
      expect(s.yMm).toBeGreaterThanOrEqual(c.marginMm);
      expect(s.xMm + c.widthMm).toBeLessThanOrEqual(A4.widthMm - c.marginMm);
      expect(s.yMm + c.heightMm).toBeLessThanOrEqual(A4.heightMm - c.marginMm);
    }
    const i = impose(c);
    const right = A4.widthMm - (i.slots[1]!.xMm + c.widthMm);
    expect(right).toBeCloseTo(i.slots[0]!.xMm);
  });

  it('applies the printer offset', () => {
    const a = impose(defaultBadgeConfig).slots[0]!;
    const b = impose({ ...defaultBadgeConfig, offsetXMm: 1.5, offsetYMm: -2 }).slots[0]!;
    expect(b.xMm - a.xMm).toBeCloseTo(1.5);
    expect(b.yMm - a.yMm).toBeCloseTo(-2);
  });

  it('rejects a card that does not fit', () => {
    expect(validateBadgeConfig({ ...defaultBadgeConfig, widthMm: 200, marginMm: 10 })).toContain('doesNotFit');
    expect(validateBadgeConfig(defaultBadgeConfig)).toEqual([]);
  });
});

describe('paginate', () => {
  it('splits into full sheets and a remainder', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([1], 0)).toEqual([]);
  });
});
