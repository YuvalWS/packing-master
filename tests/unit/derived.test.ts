import { describe, expect, it } from 'vitest';
import { derive, LONG_TRIP_DAYS, SHORT_TRIP_DAYS } from '../../src/lib/rules/derived.js';

describe('derive — day counts', () => {
  it('single day', () => {
    const d = derive('2025-01-06', '2025-01-06'); // Monday
    expect(d.days).toBe(1);
    expect(d.weekdays).toBe(1);
    expect(d.weekends).toBe(0);
  });

  it('two-day trip Sun-Mon (short)', () => {
    const d = derive('2025-01-05', '2025-01-06');
    expect(d.days).toBe(2);
    expect(d.shortTrip).toBe(true);
    expect(d.longTrip).toBe(false);
  });

  it('week-long Sun-Sat', () => {
    const d = derive('2025-01-05', '2025-01-11');
    expect(d.days).toBe(7);
    expect(d.weekdays).toBe(5); // Sun(5),Mon(6),Tue(7),Wed(8),Thu(9)
    expect(d.weekends).toBe(2); // Fri(10),Sat(11)
    expect(d.shortTrip).toBe(false);
    expect(d.longTrip).toBe(false);
  });

  it('14-day trip is longTrip', () => {
    const d = derive('2025-01-01', '2025-01-14');
    expect(d.days).toBe(LONG_TRIP_DAYS);
    expect(d.longTrip).toBe(true);
  });

  it('30-day trip is longTrip', () => {
    const d = derive('2025-01-01', '2025-01-30');
    expect(d.days).toBe(30);
    expect(d.longTrip).toBe(true);
  });

  it('1-day trip is shortTrip', () => {
    expect(derive('2025-01-06', '2025-01-06').shortTrip).toBe(true);
  });

  it('SHORT_TRIP_DAYS boundary', () => {
    expect(derive('2025-01-06', '2025-01-07').shortTrip).toBe(true); // 2 days
    expect(derive('2025-01-06', '2025-01-08').shortTrip).toBe(false); // 3 days
  });
});

describe('derive — cross-month / cross-year / leap', () => {
  it('cross-month', () => {
    const d = derive('2025-01-30', '2025-02-02');
    expect(d.days).toBe(4);
  });

  it('cross-year', () => {
    const d = derive('2024-12-30', '2025-01-02');
    expect(d.days).toBe(4);
  });

  it('leap-year Feb 28 → Mar 2 (2024)', () => {
    const d = derive('2024-02-28', '2024-03-02');
    expect(d.days).toBe(4); // Feb 28, 29, Mar 1, 2
  });
});

describe('derive — shabbat fields & derivedParamIds', () => {
  it('week with one Shabbat → derived_has_shabbat present', () => {
    const d = derive('2025-01-01', '2025-01-07');
    expect(d.hasShabbat).toBe(true);
    expect(d.shabbatCount).toBe(1);
    expect(d.derivedParamIds).toContain('derived_has_shabbat');
  });

  it('month with multiple Shabbatot', () => {
    const d = derive('2025-01-01', '2025-01-31');
    expect(d.shabbatCount).toBe(4);
  });

  it('short trip without shabbat: derived_short_trip but no shabbat', () => {
    const d = derive('2025-01-06', '2025-01-07'); // Mon-Tue
    expect(d.derivedParamIds).toEqual(['derived_short_trip']);
  });

  it('long trip with shabbat: both ids', () => {
    const d = derive('2025-01-01', '2025-01-14');
    expect(d.derivedParamIds).toContain('derived_has_shabbat');
    expect(d.derivedParamIds).toContain('derived_long_trip');
  });
});

describe('derive — validation', () => {
  it('throws if end before start', () => {
    expect(() => derive('2025-02-01', '2025-01-01')).toThrow(/before/);
  });
});
