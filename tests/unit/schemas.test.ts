import { describe, expect, it } from 'vitest';
import { ConditionSchema } from '../../src/lib/schemas/condition.js';
import { QuantitySchema } from '../../src/lib/schemas/quantity.js';
import { ParameterSchema } from '../../src/lib/schemas/parameter.js';
import { ItemSchema } from '../../src/lib/schemas/item.js';
import { TemplateSchema } from '../../src/lib/schemas/template.js';

describe('ConditionSchema', () => {
  it('accepts literal true', () => {
    expect(ConditionSchema.parse(true)).toBe(true);
  });

  it('accepts a string param id', () => {
    expect(ConditionSchema.parse('env_cold')).toBe('env_cold');
  });

  it('accepts nested and/or/not', () => {
    const cond = {
      and: [
        { or: [{ any_param: ['a', 'b'] }, 'c'] },
        { not: { all_params: ['x', 'y'] } }
      ]
    };
    expect(() => ConditionSchema.parse(cond)).not.toThrow();
  });

  it('accepts eq with string, number, boolean rhs', () => {
    expect(() => ConditionSchema.parse({ eq: ['days', 7] })).not.toThrow();
    expect(() => ConditionSchema.parse({ eq: ['accommodation', 'hotel'] })).not.toThrow();
    expect(() => ConditionSchema.parse({ eq: ['flag', true] })).not.toThrow();
  });

  it('accepts gte', () => {
    expect(() => ConditionSchema.parse({ gte: ['days', 3] })).not.toThrow();
  });

  it('accepts includes_shabbat: true', () => {
    expect(() => ConditionSchema.parse({ includes_shabbat: true })).not.toThrow();
  });

  it('rejects literal false', () => {
    expect(ConditionSchema.safeParse(false).success).toBe(false);
  });

  it('rejects unknown operator', () => {
    expect(ConditionSchema.safeParse({ xor: [true, false] }).success).toBe(false);
  });

  it('rejects empty string param id', () => {
    expect(ConditionSchema.safeParse('').success).toBe(false);
  });

  it('rejects includes_shabbat: false (must be true)', () => {
    expect(ConditionSchema.safeParse({ includes_shabbat: false }).success).toBe(false);
  });
});

describe('QuantitySchema', () => {
  it('accepts every formula shape', () => {
    expect(() => QuantitySchema.parse({ fixed: 1 })).not.toThrow();
    expect(() => QuantitySchema.parse({ per_day: 1 })).not.toThrow();
    expect(() => QuantitySchema.parse({ per_n_days: { n: 2 } })).not.toThrow();
    expect(() => QuantitySchema.parse({ per_n_days: { n: 2, min: 1 } })).not.toThrow();
    expect(() => QuantitySchema.parse({ per_weekday: 1 })).not.toThrow();
    expect(() => QuantitySchema.parse({ per_shabbat: 2 })).not.toThrow();
    expect(() => QuantitySchema.parse({ days_plus: { add: 2 } })).not.toThrow();
    expect(() => QuantitySchema.parse({ days_plus: { add: 0, min: 1 } })).not.toThrow();
  });

  it('rejects negative fixed', () => {
    expect(QuantitySchema.safeParse({ fixed: -1 }).success).toBe(false);
  });

  it('rejects per_day: 0', () => {
    expect(QuantitySchema.safeParse({ per_day: 0 }).success).toBe(false);
  });

  it('rejects per_n_days missing n', () => {
    expect(QuantitySchema.safeParse({ per_n_days: { min: 1 } }).success).toBe(false);
  });

  it('rejects unknown formula key', () => {
    expect(QuantitySchema.safeParse({ per_minute: 1 }).success).toBe(false);
  });
});

describe('ParameterSchema', () => {
  it('accepts a valid parameter with defaults applied', () => {
    const parsed = ParameterSchema.parse({
      id: 'param_a',
      display_name: 'Parameter A',
      category: 'environment'
    });
    expect(parsed.is_singleton).toBe(false);
    expect(parsed.is_derived).toBe(false);
    expect(parsed.sort_order).toBe(0);
  });

  it('rejects invalid id (uppercase / hyphen)', () => {
    expect(
      ParameterSchema.safeParse({
        id: 'Param-A',
        display_name: 'x',
        category: 'environment'
      }).success
    ).toBe(false);
  });

  it('rejects unknown category', () => {
    expect(
      ParameterSchema.safeParse({
        id: 'p',
        display_name: 'x',
        category: 'weather'
      }).success
    ).toBe(false);
  });
});

describe('ItemSchema', () => {
  const baseItem = {
    id: 'item_a',
    display_name: 'Item A',
    include_when: true,
    quantity: { fixed: 1 }
  };

  it('accepts a minimal valid item', () => {
    expect(() => ItemSchema.parse(baseItem)).not.toThrow();
  });

  it('requires kit_contents when is_kit=true', () => {
    expect(
      ItemSchema.safeParse({
        ...baseItem,
        is_kit: true
      }).success
    ).toBe(false);
  });

  it('rejects kit_contents when is_kit=false', () => {
    expect(
      ItemSchema.safeParse({
        ...baseItem,
        is_kit: false,
        kit_contents: [{ id: 'c1', display_name: 'Comp', default_count: 1 }]
      }).success
    ).toBe(false);
  });

  it('accepts a kit with components', () => {
    expect(
      ItemSchema.safeParse({
        ...baseItem,
        is_kit: true,
        kit_contents: [{ id: 'c1', display_name: 'Comp', default_count: 1 }]
      }).success
    ).toBe(true);
  });
});

describe('TemplateSchema', () => {
  it('accepts a valid template', () => {
    expect(() =>
      TemplateSchema.parse({
        id: 'tpl_a',
        display_name: 'Template A',
        default_parameters: ['accom_a', 'plan_a']
      })
    ).not.toThrow();
  });

  it('rejects template with no display_name', () => {
    expect(
      TemplateSchema.safeParse({
        id: 'tpl_a',
        display_name: '',
        default_parameters: []
      }).success
    ).toBe(false);
  });
});
