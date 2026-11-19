import type { Condition } from '$lib/schemas/condition.js';
import strings from '$lib/strings.js';

/** names: person id → display name, for {person} conditions (falls back to the id). */
export function formatCondition(cond: Condition, names?: ReadonlyMap<string, string>): string {
  const sub = (c: Condition) => formatCondition(c, names);
  if (cond === true) return strings.condition.always;
  if (typeof cond === 'string') {
    return strings.condition.param_active.replace('{id}', cond);
  }
  if ('and' in cond) {
    if (cond.and.length === 0) return strings.condition.always;
    return cond.and.map(sub).join(strings.condition.and_join);
  }
  if ('or' in cond) {
    if (cond.or.length === 0) return strings.condition.always;
    return cond.or.map(sub).join(strings.condition.or_join);
  }
  if ('not' in cond) {
    return strings.condition.not_prefix + sub(cond.not);
  }
  if ('eq' in cond) {
    return strings.condition.eq
      .replace('{path}', cond.eq[0])
      .replace('{value}', String(cond.eq[1]));
  }
  if ('gte' in cond) {
    return strings.condition.gte
      .replace('{path}', cond.gte[0])
      .replace('{value}', String(cond.gte[1]));
  }
  if ('any_param' in cond) {
    return strings.condition.any_of.replace('{ids}', cond.any_param.join(', '));
  }
  if ('all_params' in cond) {
    return strings.condition.all_of.replace('{ids}', cond.all_params.join(', '));
  }
  if ('includes_shabbat' in cond) {
    return strings.condition.includes_shabbat;
  }
  if ('person' in cond) {
    return strings.condition.person.replace('{name}', names?.get(cond.person) ?? cond.person);
  }
  if ('kind' in cond) {
    return strings.condition.kind.replace('{kind}', strings.people.kinds[cond.kind]);
  }
  if ('yom_tov' in cond) {
    return strings.condition.yom_tov;
  }
  if ('holiday' in cond) {
    return strings.condition.holiday.replace('{name}', strings.holidays[cond.holiday]);
  }
  return JSON.stringify(cond);
}
