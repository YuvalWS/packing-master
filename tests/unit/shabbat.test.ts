import { describe, expect, it } from 'vitest';
import { shabbatInfo } from '../../src/lib/rules/shabbat.js';

describe('shabbatInfo — single day', () => {
  it('Friday only → no shabbat', () => {
    // 2025-01-03 is a Friday
    expect(shabbatInfo('2025-01-03', '2025-01-03')).toEqual({
      hasShabbat: false,
      shabbatCount: 0
    });
  });
  it('Saturday only → one shabbat', () => {
    // 2025-01-04 is a Saturday
    expect(shabbatInfo('2025-01-04', '2025-01-04')).toEqual({
      hasShabbat: true,
      shabbatCount: 1
    });
  });
  it('Sunday only → no shabbat', () => {
    expect(shabbatInfo('2025-01-05', '2025-01-05')).toEqual({
      hasShabbat: false,
      shabbatCount: 0
    });
  });
});

describe('shabbatInfo — short ranges', () => {
  it('Fri → Sat counts one shabbat', () => {
    expect(shabbatInfo('2025-01-03', '2025-01-04').shabbatCount).toBe(1);
  });
  it('Fri → Sun counts one shabbat', () => {
    expect(shabbatInfo('2025-01-03', '2025-01-05').shabbatCount).toBe(1);
  });
  it('Sun → Thu has no shabbat', () => {
    expect(shabbatInfo('2025-01-05', '2025-01-09').hasShabbat).toBe(false);
  });
});

describe('shabbatInfo — week-long', () => {
  it('Wed → Tue covers one shabbat (Jan 4 2025)', () => {
    expect(shabbatInfo('2025-01-01', '2025-01-07')).toEqual({
      hasShabbat: true,
      shabbatCount: 1
    });
  });
});

describe('shabbatInfo — full month', () => {
  it('January 2025 has four Saturdays', () => {
    // Sats: Jan 4, 11, 18, 25
    expect(shabbatInfo('2025-01-01', '2025-01-31').shabbatCount).toBe(4);
  });
});

describe('shabbatInfo — cross-year', () => {
  it('2024-12-25 → 2025-01-15: 3 Saturdays', () => {
    // Sats: Dec 28, Jan 4, Jan 11
    expect(shabbatInfo('2024-12-25', '2025-01-15').shabbatCount).toBe(3);
  });
});

describe('shabbatInfo — cross-month leap year', () => {
  it('2024-02-28 (Wed) → 2024-03-02 (Sat): 1 Saturday', () => {
    expect(shabbatInfo('2024-02-28', '2024-03-02').shabbatCount).toBe(1);
  });
});

describe('shabbatInfo — validation', () => {
  it('throws when end before start', () => {
    expect(() => shabbatInfo('2025-01-10', '2025-01-09')).toThrow(/before/);
  });
  it('throws on malformed date', () => {
    expect(() => shabbatInfo('bad', '2025-01-01')).toThrow(/invalid/);
  });
});
