import { describe, expect, it } from 'vitest';
import { formatWalletDate } from './date';

describe('wallet dates in Mexico City', () => {
  it.each([
    ['2026-11-19T00:01:00.000Z', '18 nov', '18:01'],
    ['2026-11-19T05:59:00.000Z', '18 nov', '23:59'],
    ['2026-11-19T06:00:00.000Z', '19 nov', '00:00'],
    ['2027-01-01T05:59:00.000Z', '31 dic', '23:59'],
  ])('keeps movement and receipt on the same local day for %s', (instant, day, time) => {
    expect(formatWalletDate(instant, 'movement')).toBe(day);
    expect(formatWalletDate(instant, 'receipt')).toContain(day);
    expect(formatWalletDate(instant, 'receipt')).toContain(time);
  });

  it('uses the local year for a receipt just before New Year', () => {
    expect(formatWalletDate('2027-01-01T05:59:00.000Z', 'receipt')).toContain('2026');
  });
});
