import { describe, expect, it } from 'vitest';
import { shabbatInfo } from '../../src/lib/rules/shabbat.js';

describe('shabbatInfo — single day', () => {
  it('Friday only → no shabbat', () => {
    // 2025-01-03 is a Friday
    expect(shabbatInfo('2025-01-03', '2025-01-03')).toMatchObject({
      hasShabbat: false,
      shabbatCount: 0
    });
  });
  it('Saturday only → one shabbat', () => {
    // 2025-01-04 is a Saturday
    expect(shabbatInfo('2025-01-04', '2025-01-04')).toMatchObject({
      hasShabbat: true,
      shabbatCount: 1
    });
  });
  it('Sunday only → no shabbat', () => {
    expect(shabbatInfo('2025-01-05', '2025-01-05')).toMatchObject({
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
    expect(shabbatInfo('2025-01-01', '2025-01-07')).toMatchObject({
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

describe('shabbatInfo — Yom Tov and holidays (Israel)', () => {
  it('counts Yom Tov as a holy day, a Shabbat that is also Yom Tov once', () => {
    // Erev Rosh Hashana Fri 2026-09-11; RH I is Shabbat 09-12, RH II Sunday 09-13.
    expect(shabbatInfo('2026-09-11', '2026-09-13')).toMatchObject({
      hasShabbat: true,
      shabbatCount: 2,
      yomTovCount: 2,
      holidays: ['rosh_hashana']
    });
  });

  it('adds Yom Tov to the Shabbat after it', () => {
    // Shavuot is Friday 2027-06-11, then Shabbat.
    expect(shabbatInfo('2027-06-10', '2027-06-12')).toMatchObject({
      shabbatCount: 2,
      yomTovCount: 1,
      holidays: ['shavuot']
    });
  });

  it('counts a holiday that starts at night only if the trip includes that night', () => {
    // First Chanukah candle: the evening of Friday 2026-12-04.
    expect(shabbatInfo('2026-12-03', '2026-12-04').holidays).toEqual([]);
    expect(shabbatInfo('2026-12-04', '2026-12-05').holidays).toEqual(['chanukah']);
  });

  it('includes Chol HaMoed in the holiday but not in the holy days', () => {
    // Pesach 2027: Pesach I Thu 04-22; Chol HaMoed Sun 04-25 .. Tue 04-27.
    expect(shabbatInfo('2027-04-25', '2027-04-26')).toMatchObject({
      hasShabbat: false,
      yomTovCount: 0,
      holidays: ['pesach']
    });
  });

  it('renders the Hebrew dates', () => {
    const r = shabbatInfo('2026-11-20', '2026-11-22');
    expect(r.hebrewStart).not.toBe(r.hebrewEnd);
    expect(r.hebrewStart.length).toBeGreaterThan(0);
  });
});
