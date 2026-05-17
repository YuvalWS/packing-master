import { describe, expect, it } from 'vitest';
import { computeQuantity, type QuantityContext } from '../../src/lib/rules/quantity.js';

const ctx = (overrides: Partial<QuantityContext> = {}): QuantityContext => ({
  days: 7,
  weekdays: 5,
  shabbatCount: 1,
  ...overrides
});

describe('computeQuantity — fixed', () => {
  it('returns the fixed value regardless of trip', () => {
    expect(computeQuantity({ fixed: 3 }, ctx({ days: 1 }))).toBe(3);
    expect(computeQuantity({ fixed: 3 }, ctx({ days: 30 }))).toBe(3);
    expect(computeQuantity({ fixed: 0 }, ctx())).toBe(0);
  });
});

describe('computeQuantity — per_day', () => {
  it('scales with days', () => {
    expect(computeQuantity({ per_day: 1 }, ctx({ days: 1 }))).toBe(1);
    expect(computeQuantity({ per_day: 1 }, ctx({ days: 7 }))).toBe(7);
    expect(computeQuantity({ per_day: 2 }, ctx({ days: 5 }))).toBe(10);
  });
  it('zero-day trip yields zero', () => {
    expect(computeQuantity({ per_day: 1 }, ctx({ days: 0 }))).toBe(0);
  });
});

describe('computeQuantity — per_n_days', () => {
  it('ceil(days/n)', () => {
    expect(computeQuantity({ per_n_days: { n: 2 } }, ctx({ days: 7 }))).toBe(4);
    expect(computeQuantity({ per_n_days: { n: 3 } }, ctx({ days: 6 }))).toBe(2);
    expect(computeQuantity({ per_n_days: { n: 3 } }, ctx({ days: 1 }))).toBe(1);
  });
  it('honors min', () => {
    expect(computeQuantity({ per_n_days: { n: 7, min: 2 } }, ctx({ days: 1 }))).toBe(2);
    expect(computeQuantity({ per_n_days: { n: 7, min: 2 } }, ctx({ days: 30 }))).toBe(5);
  });
  it('zero-day trip yields min (or 0)', () => {
    expect(computeQuantity({ per_n_days: { n: 2 } }, ctx({ days: 0 }))).toBe(0);
    expect(computeQuantity({ per_n_days: { n: 2, min: 1 } }, ctx({ days: 0 }))).toBe(1);
  });
});

describe('computeQuantity — per_weekday', () => {
  it('scales with weekdays', () => {
    expect(computeQuantity({ per_weekday: 1 }, ctx({ weekdays: 5 }))).toBe(5);
    expect(computeQuantity({ per_weekday: 2 }, ctx({ weekdays: 3 }))).toBe(6);
    expect(computeQuantity({ per_weekday: 1 }, ctx({ weekdays: 0 }))).toBe(0);
  });
});

describe('computeQuantity — per_shabbat', () => {
  it('scales with shabbat count', () => {
    expect(computeQuantity({ per_shabbat: 1 }, ctx({ shabbatCount: 1 }))).toBe(1);
    expect(computeQuantity({ per_shabbat: 1 }, ctx({ shabbatCount: 4 }))).toBe(4);
    expect(computeQuantity({ per_shabbat: 2 }, ctx({ shabbatCount: 0 }))).toBe(0);
  });
});

describe('computeQuantity — days_plus', () => {
  it('days + add', () => {
    expect(computeQuantity({ days_plus: { add: 2 } }, ctx({ days: 5 }))).toBe(7);
    expect(computeQuantity({ days_plus: { add: 0 } }, ctx({ days: 5 }))).toBe(5);
    expect(computeQuantity({ days_plus: { add: -1 } }, ctx({ days: 5 }))).toBe(4);
  });
  it('honors min', () => {
    expect(computeQuantity({ days_plus: { add: 0, min: 3 } }, ctx({ days: 1 }))).toBe(3);
    expect(computeQuantity({ days_plus: { add: 5, min: 3 } }, ctx({ days: 1 }))).toBe(6);
  });
});

describe('computeQuantity — unknown formula', () => {
  it('throws', () => {
    expect(() => computeQuantity({ per_minute: 1 } as never, ctx())).toThrow(/unknown/);
  });
});
