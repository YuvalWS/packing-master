import type { Condition } from '$lib/schemas/condition.js';

/* Collects every parameter id a condition references, for catalog
   filtering. eq/gte address context paths and includes_shabbat is
   date-derived, so none of those contribute ids. */
export function conditionParamIds(cond: Condition): string[] {
  const out = new Set<string>();
  collect(cond, out);
  return [...out];
}

function collect(cond: Condition, out: Set<string>): void {
  if (cond === true) return;
  if (typeof cond === 'string') {
    out.add(cond);
    return;
  }
  if ('and' in cond) {
    for (const c of cond.and) collect(c, out);
    return;
  }
  if ('or' in cond) {
    for (const c of cond.or) collect(c, out);
    return;
  }
  if ('not' in cond) {
    collect(cond.not, out);
    return;
  }
  if ('any_param' in cond) {
    for (const id of cond.any_param) out.add(id);
    return;
  }
  if ('all_params' in cond) {
    for (const id of cond.all_params) out.add(id);
    return;
  }
}
