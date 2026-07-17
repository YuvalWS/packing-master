import { describe, it, expect } from 'vitest';
import { conditionParamIds } from '../../../src/lib/util/condition-params.js';

describe('conditionParamIds', () => {
  it('literal true references nothing', () => {
    expect(conditionParamIds(true)).toEqual([]);
  });

  it('a bare string is a single param reference', () => {
    expect(conditionParamIds('env_cold')).toEqual(['env_cold']);
  });

  it('collects across and/or compositions', () => {
    expect(
      conditionParamIds({ and: ['env_a', { or: ['plan_a', 'plan_b'] }] })
    ).toEqual(['env_a', 'plan_a', 'plan_b']);
  });

  it('collects through not', () => {
    expect(conditionParamIds({ not: 'plan_b' })).toEqual(['plan_b']);
  });

  it('collects any_param and all_params arrays', () => {
    expect(conditionParamIds({ any_param: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(conditionParamIds({ all_params: ['c', 'd'] })).toEqual(['c', 'd']);
  });

  it('ignores eq, gte, and includes_shabbat', () => {
    expect(conditionParamIds({ eq: ['days', 3] })).toEqual([]);
    expect(conditionParamIds({ gte: ['days', 7] })).toEqual([]);
    expect(conditionParamIds({ includes_shabbat: true })).toEqual([]);
  });

  it('deduplicates ids in deep nesting', () => {
    expect(
      conditionParamIds({
        and: [
          { or: ['env_a', { not: 'env_a' }] },
          { any_param: ['env_a', 'env_b'] },
          { all_params: ['env_b'] },
          { includes_shabbat: true }
        ]
      })
    ).toEqual(['env_a', 'env_b']);
  });

  it('empty and/or arrays reference nothing', () => {
    expect(conditionParamIds({ and: [] })).toEqual([]);
    expect(conditionParamIds({ or: [] })).toEqual([]);
  });
});
