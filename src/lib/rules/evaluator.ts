import type { Condition } from '../schemas/condition.js';

export interface Traveler {
  id: string;
  kind: 'adult' | 'kid' | 'baby';
}

export interface EvalContext {
  activeParams: ReadonlySet<string>;
  params: Readonly<Record<string, unknown>>;
  /** Who is coming; undefined for trips without people (person/kind are then false). */
  travelers?: readonly Traveler[];
  /** Holiday ids the trip overlaps (DESIGN.md 14.1). */
  holidays?: ReadonlySet<string>;
}

function readPath(obj: Record<string, unknown>, path: string): unknown {
  if (path in obj) return obj[path];
  // dotted path support: "trip.days" → obj.trip.days
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function evaluate(condition: Condition, ctx: EvalContext): boolean {
  if (condition === true) return true;

  if (typeof condition === 'string') {
    return ctx.activeParams.has(condition);
  }

  if ('and' in condition) {
    return condition.and.every((c) => evaluate(c, ctx));
  }

  if ('or' in condition) {
    return condition.or.some((c) => evaluate(c, ctx));
  }

  if ('not' in condition) {
    return !evaluate(condition.not, ctx);
  }

  if ('eq' in condition) {
    const [path, expected] = condition.eq;
    const actual = readPath(ctx.params, path);
    return actual === expected;
  }

  if ('gte' in condition) {
    const [path, expected] = condition.gte;
    const actual = readPath(ctx.params, path);
    return typeof actual === 'number' && actual >= expected;
  }

  if ('any_param' in condition) {
    return condition.any_param.some((id) => ctx.activeParams.has(id));
  }

  if ('all_params' in condition) {
    return condition.all_params.every((id) => ctx.activeParams.has(id));
  }

  if ('includes_shabbat' in condition) {
    return ctx.activeParams.has('derived_has_shabbat');
  }

  if ('person' in condition) {
    return ctx.travelers?.some((t) => t.id === condition.person) ?? false;
  }

  if ('kind' in condition) {
    return ctx.travelers?.some((t) => t.kind === condition.kind) ?? false;
  }

  if ('yom_tov' in condition) {
    const n = ctx.params.yomTovCount;
    return typeof n === 'number' && n > 0;
  }

  if ('holiday' in condition) {
    return ctx.holidays?.has(condition.holiday) ?? false;
  }

  // Exhaustiveness guard: TypeScript can't see the path with `in`-narrowing
  // perfectly, but at runtime we want to be explicit.
  throw new Error(`unknown condition operator: ${JSON.stringify(condition)}`);
}
