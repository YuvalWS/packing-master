import type { QuantityFormula } from '../schemas/quantity.js';

export interface QuantityContext {
  days: number;
  weekdays: number;
  shabbatCount: number;
}

export function computeQuantity(formula: QuantityFormula, ctx: QuantityContext): number {
  if ('fixed' in formula) {
    return formula.fixed;
  }
  if ('per_day' in formula) {
    return formula.per_day * Math.max(0, ctx.days);
  }
  if ('per_n_days' in formula) {
    const { n, min } = formula.per_n_days;
    const base = Math.ceil(Math.max(0, ctx.days) / n);
    return Math.max(base, min ?? 0);
  }
  if ('per_weekday' in formula) {
    return formula.per_weekday * Math.max(0, ctx.weekdays);
  }
  if ('per_shabbat' in formula) {
    return formula.per_shabbat * Math.max(0, ctx.shabbatCount);
  }
  if ('days_plus' in formula) {
    const { add, min } = formula.days_plus;
    const base = Math.max(0, ctx.days) + add;
    return Math.max(base, min ?? 0);
  }

  throw new Error(`unknown quantity formula: ${JSON.stringify(formula)}`);
}
