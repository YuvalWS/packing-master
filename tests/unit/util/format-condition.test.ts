import { describe, it, expect } from 'vitest';
import { formatCondition } from '../../../src/lib/util/format-condition.js';
import strings from '../../../src/lib/strings.js';

describe('formatCondition', () => {
  it('formats true', () => {
    expect(formatCondition(true)).toBe(strings.condition.always);
  });

  it('formats a bare param id', () => {
    expect(formatCondition('env_cold')).toBe(
      strings.condition.param_active.replace('{id}', 'env_cold')
    );
  });

  it('joins and clauses', () => {
    const out = formatCondition({ and: ['a', 'b'] });
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain(strings.condition.and_join.trim());
  });

  it('joins or clauses', () => {
    const out = formatCondition({ or: ['a', 'b'] });
    expect(out).toContain(strings.condition.or_join.trim());
  });

  it('prefixes not', () => {
    const out = formatCondition({ not: 'env_cold' });
    expect(out.startsWith(strings.condition.not_prefix)).toBe(true);
  });

  it('formats eq', () => {
    expect(formatCondition({ eq: ['days', 7] })).toContain('days');
    expect(formatCondition({ eq: ['days', 7] })).toContain('7');
  });

  it('formats gte', () => {
    expect(formatCondition({ gte: ['days', 5] })).toContain('5');
  });

  it('formats any_param with comma-separated ids', () => {
    expect(formatCondition({ any_param: ['x', 'y', 'z'] })).toContain('x, y, z');
  });

  it('formats all_params with comma-separated ids', () => {
    expect(formatCondition({ all_params: ['x', 'y'] })).toContain('x, y');
  });

  it('formats includes_shabbat', () => {
    expect(formatCondition({ includes_shabbat: true })).toBe(strings.condition.includes_shabbat);
  });

  it('falls back to always when an and/or array is empty', () => {
    expect(formatCondition({ and: [] })).toBe(strings.condition.always);
    expect(formatCondition({ or: [] })).toBe(strings.condition.always);
  });

  it('recurses through nested compositions', () => {
    const out = formatCondition({
      and: [{ or: ['a', 'b'] }, { not: 'c' }]
    });
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain('c');
  });
});
