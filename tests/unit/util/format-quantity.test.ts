import { describe, it, expect } from 'vitest';
import { formatQuantity } from '../../../src/lib/util/format-quantity.js';
import strings from '../../../src/lib/strings.js';

describe('formatQuantity', () => {
  it('formats fixed', () => {
    expect(formatQuantity({ fixed: 5 })).toBe(strings.quantity.fixed.replace('{n}', '5'));
  });

  it('formats per_day', () => {
    expect(formatQuantity({ per_day: 2 })).toBe(strings.quantity.per_day.replace('{n}', '2'));
  });

  it('formats per_n_days without min', () => {
    const out = formatQuantity({ per_n_days: { n: 3 } });
    expect(out).toContain('3');
    expect(out).not.toContain('מינימום');
  });

  it('formats per_n_days with min', () => {
    const out = formatQuantity({ per_n_days: { n: 3, min: 2 } });
    expect(out).toContain('3');
    expect(out).toContain('2');
    expect(out).toContain(strings.quantity.per_n_days_with_min.split('(')[1]!.slice(0, 6));
  });

  it('formats per_weekday', () => {
    expect(formatQuantity({ per_weekday: 4 })).toContain('4');
  });

  it('formats per_shabbat', () => {
    expect(formatQuantity({ per_shabbat: 1 })).toContain('1');
  });

  it('formats days_plus without min', () => {
    const out = formatQuantity({ days_plus: { add: 1 } });
    expect(out).toContain('1');
  });

  it('formats days_plus with min', () => {
    const out = formatQuantity({ days_plus: { add: 1, min: 2 } });
    expect(out).toContain('1');
    expect(out).toContain('2');
  });
});
