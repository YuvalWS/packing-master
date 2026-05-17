import { describe, expect, it } from 'vitest';
import { evaluate, type EvalContext } from '../../src/lib/rules/evaluator.js';

function ctx(active: string[] = [], params: Record<string, unknown> = {}): EvalContext {
  return { activeParams: new Set(active), params };
}

describe('evaluate — literal true', () => {
  it('always true', () => {
    expect(evaluate(true, ctx())).toBe(true);
    expect(evaluate(true, ctx(['x']))).toBe(true);
  });
});

describe('evaluate — string param', () => {
  it('true when param is active', () => {
    expect(evaluate('env_a', ctx(['env_a']))).toBe(true);
  });
  it('false when param is not active', () => {
    expect(evaluate('env_a', ctx(['env_b']))).toBe(false);
  });
  it('false with empty active set', () => {
    expect(evaluate('env_a', ctx([]))).toBe(false);
  });
});

describe('evaluate — and', () => {
  it('true when all subconditions true', () => {
    expect(evaluate({ and: [true, 'a'] }, ctx(['a']))).toBe(true);
  });
  it('false when any subcondition false', () => {
    expect(evaluate({ and: [true, 'a'] }, ctx([]))).toBe(false);
  });
  it('empty and is vacuously true', () => {
    expect(evaluate({ and: [] }, ctx())).toBe(true);
  });
});

describe('evaluate — or', () => {
  it('true when any subcondition true', () => {
    expect(evaluate({ or: ['a', 'b'] }, ctx(['b']))).toBe(true);
  });
  it('false when all subconditions false', () => {
    expect(evaluate({ or: ['a', 'b'] }, ctx(['c']))).toBe(false);
  });
  it('empty or is false', () => {
    expect(evaluate({ or: [] }, ctx())).toBe(false);
  });
});

describe('evaluate — not', () => {
  it('inverts truth', () => {
    expect(evaluate({ not: true }, ctx())).toBe(false);
    expect(evaluate({ not: 'a' }, ctx(['a']))).toBe(false);
    expect(evaluate({ not: 'a' }, ctx([]))).toBe(true);
  });
});

describe('evaluate — eq', () => {
  it('matches scalar values', () => {
    expect(evaluate({ eq: ['days', 7] }, ctx([], { days: 7 }))).toBe(true);
    expect(evaluate({ eq: ['days', 7] }, ctx([], { days: 8 }))).toBe(false);
    expect(evaluate({ eq: ['mode', 'hot'] }, ctx([], { mode: 'hot' }))).toBe(true);
  });
  it('false when path missing', () => {
    expect(evaluate({ eq: ['nope', 1] }, ctx([], {}))).toBe(false);
  });
  it('supports dotted paths', () => {
    expect(evaluate({ eq: ['t.x', 1] }, ctx([], { t: { x: 1 } }))).toBe(true);
  });
});

describe('evaluate — gte', () => {
  it('true when value >= expected', () => {
    expect(evaluate({ gte: ['days', 3] }, ctx([], { days: 3 }))).toBe(true);
    expect(evaluate({ gte: ['days', 3] }, ctx([], { days: 10 }))).toBe(true);
  });
  it('false when value < expected', () => {
    expect(evaluate({ gte: ['days', 3] }, ctx([], { days: 2 }))).toBe(false);
  });
  it('false when value missing or non-numeric', () => {
    expect(evaluate({ gte: ['days', 3] }, ctx([], {}))).toBe(false);
    expect(evaluate({ gte: ['days', 3] }, ctx([], { days: 'many' }))).toBe(false);
  });
});

describe('evaluate — any_param', () => {
  it('true when any listed param active', () => {
    expect(evaluate({ any_param: ['a', 'b'] }, ctx(['b']))).toBe(true);
  });
  it('false when none active', () => {
    expect(evaluate({ any_param: ['a', 'b'] }, ctx(['c']))).toBe(false);
  });
  it('empty any_param is false', () => {
    expect(evaluate({ any_param: [] }, ctx(['anything']))).toBe(false);
  });
});

describe('evaluate — all_params', () => {
  it('true when all listed params active', () => {
    expect(evaluate({ all_params: ['a', 'b'] }, ctx(['a', 'b', 'c']))).toBe(true);
  });
  it('false when any missing', () => {
    expect(evaluate({ all_params: ['a', 'b'] }, ctx(['a']))).toBe(false);
  });
  it('empty all_params is vacuously true', () => {
    expect(evaluate({ all_params: [] }, ctx())).toBe(true);
  });
});

describe('evaluate — includes_shabbat', () => {
  it('true when derived_has_shabbat is active', () => {
    expect(evaluate({ includes_shabbat: true }, ctx(['derived_has_shabbat']))).toBe(true);
  });
  it('false otherwise', () => {
    expect(evaluate({ includes_shabbat: true }, ctx([]))).toBe(false);
    expect(evaluate({ includes_shabbat: true }, ctx(['env_a']))).toBe(false);
  });
});

describe('evaluate — deep nesting', () => {
  it('handles 4+ levels', () => {
    const c = {
      and: [
        { or: [{ not: { and: ['x', 'y'] } }, 'z'] },
        { any_param: ['a', 'b'] }
      ]
    };
    // active a,z but neither x nor y → not(and(x,y)) = true → or(true,z)=true → and(true, any[a,b])=true (a in)
    expect(evaluate(c, ctx(['a', 'z']))).toBe(true);
    // active x,y,a → not(and(x,y))=false, z not active → or=false → and=false
    expect(evaluate(c, ctx(['x', 'y', 'a']))).toBe(false);
  });
});

describe('evaluate — unknown operator', () => {
  it('throws on unrecognized condition shape', () => {
    expect(() => evaluate({ xor: [true, false] } as never, ctx())).toThrow(/unknown/);
  });
});
