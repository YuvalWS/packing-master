import type { QuantityFormula } from '$lib/schemas/quantity.js';
import strings from '$lib/strings.js';

export function formatQuantity(q: QuantityFormula): string {
  if ('fixed' in q) return strings.quantity.fixed.replace('{n}', String(q.fixed));
  if ('per_day' in q) return strings.quantity.per_day.replace('{n}', String(q.per_day));
  if ('per_n_days' in q) {
    const { n, min } = q.per_n_days;
    if (min !== undefined) {
      return strings.quantity.per_n_days_with_min
        .replace('{n}', '1')
        .replace('{days}', String(n))
        .replace('{min}', String(min));
    }
    return strings.quantity.per_n_days_no_min.replace('{n}', '1').replace('{days}', String(n));
  }
  if ('per_weekday' in q) {
    return strings.quantity.per_weekday.replace('{n}', String(q.per_weekday));
  }
  if ('per_shabbat' in q) {
    return strings.quantity.per_shabbat.replace('{n}', String(q.per_shabbat));
  }
  if ('days_plus' in q) {
    const { add, min } = q.days_plus;
    if (min !== undefined) {
      return strings.quantity.days_plus_with_min
        .replace('{add}', String(add))
        .replace('{min}', String(min));
    }
    return strings.quantity.days_plus_no_min.replace('{add}', String(add));
  }
  return JSON.stringify(q);
}
