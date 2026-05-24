import type { Condition } from '$lib/schemas/condition.js';
import strings from '$lib/strings.js';

export function formatCondition(cond: Condition): string {
  if (cond === true) return strings.condition.always;
  if (typeof cond === 'string') {
    return strings.condition.param_active.replace('{id}', cond);
  }
  if ('and' in cond) {
    if (cond.and.length === 0) return strings.condition.always;
    return cond.and.map(formatCondition).join(strings.condition.and_join);
  }
  if ('or' in cond) {
    if (cond.or.length === 0) return strings.condition.always;
    return cond.or.map(formatCondition).join(strings.condition.or_join);
  }
  if ('not' in cond) {
    return strings.condition.not_prefix + formatCondition(cond.not);
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
  return JSON.stringify(cond);
}
