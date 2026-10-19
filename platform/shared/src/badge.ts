// Badge layout and A4 imposition, in millimetres. Used by the admin print view; pure and tested.

export type BadgeConfig = {
  widthMm: number;
  heightMm: number;
  marginMm: number; // minimum distance from the sheet edge (printer's unprintable area)
  gapMm: number; // space between cards, room for crop marks
  cropMarks: boolean;
  offsetXMm: number; // printer alignment correction
  offsetYMm: number;
  showCategory: boolean; // Q3 decided by the organisers (2026-10-19): printed, large
  showBus: boolean;
  showFacility: boolean;
  showEmergencyPhone: boolean;
};

export const defaultBadgeConfig: BadgeConfig = {
  widthMm: 90,
  heightMm: 55,
  marginMm: 10,
  gapMm: 4,
  cropMarks: true,
  offsetXMm: 0,
  offsetYMm: 0,
  showCategory: true,
  showBus: true,
  showFacility: true,
  showEmergencyPhone: true,
};

export const A4 = { widthMm: 210, heightMm: 297 } as const;

export type Slot = { xMm: number; yMm: number };
export type Imposition = { columns: number; rows: number; perSheet: number; slots: Slot[] };

// Fits as many cards as possible on the sheet and centres the grid.
export function impose(c: BadgeConfig, sheet = A4): Imposition {
  const fit = (avail: number, size: number) => Math.max(0, Math.floor((avail + c.gapMm) / (size + c.gapMm)));
  const columns = fit(sheet.widthMm - 2 * c.marginMm, c.widthMm);
  const rows = fit(sheet.heightMm - 2 * c.marginMm, c.heightMm);
  const gridW = columns * c.widthMm + Math.max(0, columns - 1) * c.gapMm;
  const gridH = rows * c.heightMm + Math.max(0, rows - 1) * c.gapMm;
  const left = (sheet.widthMm - gridW) / 2 + c.offsetXMm;
  const top = (sheet.heightMm - gridH) / 2 + c.offsetYMm;
  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < columns; col++)
      slots.push({ xMm: left + col * (c.widthMm + c.gapMm), yMm: top + r * (c.heightMm + c.gapMm) });
  return { columns, rows, perSheet: columns * rows, slots };
}

// Splits a list into sheets of `perSheet`.
export function paginate<T>(items: T[], perSheet: number): T[][] {
  if (perSheet <= 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perSheet) pages.push(items.slice(i, i + perSheet));
  return pages;
}

export function validateBadgeConfig(c: BadgeConfig): string[] {
  const errors: string[] = [];
  if (!(c.widthMm >= 40 && c.widthMm <= 200)) errors.push('widthMm');
  if (!(c.heightMm >= 25 && c.heightMm <= 280)) errors.push('heightMm');
  if (!(c.marginMm >= 0 && c.marginMm <= 30)) errors.push('marginMm');
  if (!(c.gapMm >= 0 && c.gapMm <= 30)) errors.push('gapMm');
  if (impose(c).perSheet === 0) errors.push('doesNotFit');
  return errors;
}
