import { describe, it, expect } from 'vitest';
import {
  buildCondition,
  extract,
  itemId,
  parseCell,
  renderItemsYaml,
  type Grid
} from '../../src/lib/seed/extract.js';
import { ExtractConfigSchema } from '../../src/lib/schemas/extract-config.js';
import { ItemsFileSchema } from '../../src/lib/schemas/item.js';
import yaml from 'js-yaml';

describe('parseCell', () => {
  it('returns null for blank cells', () => {
    expect(parseCell('')).toBeNull();
    expect(parseCell('   ')).toBeNull();
    expect(parseCell('?')).toBeNull();
  });

  it('reads a leading count', () => {
    expect(parseCell('3 shirts')).toEqual({ name: 'shirts', count: 3, is_optional: false });
    expect(parseCell('8*socks')).toEqual({ name: 'socks', count: 8, is_optional: false });
    expect(parseCell('2Xtowel')).toEqual({ name: 'towel', count: 2, is_optional: false });
  });

  it('reads a trailing count', () => {
    expect(parseCell('cable*2')).toEqual({ name: 'cable', count: 2, is_optional: false });
    expect(parseCell('tuna *3')).toEqual({ name: 'tuna', count: 3, is_optional: false });
  });

  it('treats a trailing question mark as optional', () => {
    expect(parseCell('umbrella?')).toEqual({ name: 'umbrella', count: undefined, is_optional: true });
    expect(parseCell('blanket??')).toEqual({ name: 'blanket', count: undefined, is_optional: true });
  });

  it('collapses whitespace and combines markers', () => {
    expect(parseCell('  2  rain   jacket ?  ')).toEqual({
      name: 'rain jacket',
      count: 2,
      is_optional: true
    });
  });

  it('keeps names that merely contain digits', () => {
    expect(parseCell('type 2 adapter')?.name).toBe('type 2 adapter');
    expect(parseCell('adapter type c')).toEqual({
      name: 'adapter type c',
      count: undefined,
      is_optional: false
    });
  });
});

describe('itemId', () => {
  it('is deterministic and schema-safe', () => {
    expect(itemId('towel')).toBe(itemId('towel'));
    expect(itemId('towel')).not.toBe(itemId('towels'));
    expect(itemId('towel')).toMatch(/^item_[a-f0-9]{10}$/);
  });
});

describe('buildCondition', () => {
  it('is unconditional when any occurrence carried no parameters', () => {
    expect(buildCondition([['env_cold'], []])).toBe(true);
    expect(buildCondition([])).toBe(true);
  });

  it('collapses a single parameter to a bare string', () => {
    expect(buildCondition([['env_cold'], ['env_cold']])).toBe('env_cold');
  });

  it('uses all_params for one multi-parameter occurrence', () => {
    expect(buildCondition([['plan_cooking', 'env_abroad']])).toEqual({
      all_params: ['env_abroad', 'plan_cooking']
    });
  });

  it('uses any_param when every occurrence is a single parameter', () => {
    expect(buildCondition([['env_cold'], ['plan_hiking'], ['env_cold']])).toEqual({
      any_param: ['env_cold', 'plan_hiking']
    });
  });

  it('falls back to or of mixed occurrence shapes', () => {
    expect(buildCondition([['env_cold'], ['plan_hiking', 'plan_cooking']])).toEqual({
      or: ['env_cold', { all_params: ['plan_cooking', 'plan_hiking'] }]
    });
  });
});

const config = ExtractConfigSchema.parse({
  base_threshold: 2,
  parameters: [
    { id: 'accom_a', display_name: 'Accommodation A', category: 'accommodation', is_singleton: true },
    { id: 'env_cold', display_name: 'Cold', category: 'environment' },
    { id: 'plan_hiking', display_name: 'Hiking', category: 'day_plans' }
  ],
  ignore: { values: ['Clothing'], patterns: ['^TODO'] },
  aliases: { 'wool hat': 'hat' },
  quantity_rules: { socks: { per_day: 1 } },
  item_overrides: {
    hat: { include_when: 'env_cold' },
    'camping stove': { skip: true }
  },
  sheets: [
    {
      name: 'Trip',
      parameters: ['plan_hiking'],
      template: {
        id: 'tpl_trip',
        display_name: 'Trip',
        default_parameters: ['accom_a', 'plan_hiking']
      },
      columns: [
        { index: 0, from_row: 1, category: 'Clothing', bag: 'main_bag' },
        { index: 1, from_row: 1, category: 'Gear', bag: 'small_bag', parameters: ['env_cold'] }
      ]
    },
    {
      name: 'Hotel',
      template: {
        id: 'tpl_hotel',
        display_name: 'Hotel',
        default_parameters: ['accom_a']
      },
      columns: [{ index: 0, from_row: 1, category: 'Clothing', bag: 'suitcase' }]
    },
    { name: 'Scratch', skip: true, columns: [] }
  ]
});

const grids = new Map<string, Grid>([
  [
    'Trip',
    [
      ['Clothing', 'Gear'],
      ['3 socks', 'wool hat'],
      ['towel?', 'camping stove'],
      ['TODO buy batteries', 'rope*2']
    ]
  ],
  ['Hotel', [['Clothing'], ['socks'], ['towel']]],
  ['Scratch', [['ignored entirely']]]
]);

describe('extract', () => {
  const result = extract(grids, config);
  const byName = new Map(result.items.map((i) => [i.display_name, i]));

  it('drops ignored values and unmapped cells', () => {
    expect(byName.has('Clothing')).toBe(false);
    expect(byName.has('buy batteries')).toBe(false);
    expect(result.report.ignored.some((i) => i.value === 'Clothing')).toBe(true);
  });

  it('skips sheets and items turned off in the config', () => {
    expect(byName.has('ignored entirely')).toBe(false);
    expect(byName.has('camping stove')).toBe(false);
  });

  it('merges the same item across sheets and applies aliases', () => {
    expect(byName.get('socks')?.review.sheets).toEqual(['Hotel', 'Trip']);
    expect(byName.has('hat')).toBe(true);
    expect(byName.has('wool hat')).toBe(false);
  });

  it('prefers a quantity rule over the count in the cell', () => {
    expect(byName.get('socks')?.quantity).toEqual({ per_day: 1 });
    expect(byName.get('socks')?.review.quantity_source).toBe('rule');
    expect(byName.get('rope')?.quantity).toEqual({ fixed: 2 });
    expect(byName.get('towel')?.quantity).toEqual({ fixed: 1 });
    expect(byName.get('towel')?.review.quantity_source).toBe('default');
  });

  it('treats items seen on enough templated sheets as base items', () => {
    expect(byName.get('socks')?.include_when).toBe(true);
    expect(byName.get('socks')?.review.condition_source).toBe('base_threshold');
  });

  it('builds conditions from the parameters of each occurrence', () => {
    expect(byName.get('rope')?.include_when).toEqual({ all_params: ['env_cold', 'plan_hiking'] });
    expect(byName.get('hat')?.include_when).toBe('env_cold');
    expect(byName.get('hat')?.review.condition_source).toBe('override');
  });

  it('carries the optional marker and column metadata', () => {
    const towel = byName.get('towel');
    expect(towel?.is_optional).toBe(false); // optional on Trip, plain on Hotel
    expect(towel?.category).toBe('Clothing');
    expect(byName.get('rope')?.default_bag).toBe('small_bag');
  });

  it('reports parameters that were never declared', () => {
    const bad = extract(
      new Map([['Trip', [['h'], ['thing']]]]),
      ExtractConfigSchema.parse({
        parameters: [],
        sheets: [
          {
            name: 'Trip',
            columns: [{ index: 0, from_row: 1, parameters: ['does_not_exist'] }]
          }
        ]
      })
    );
    expect(bad.report.unknownParameters).toEqual(['does_not_exist']);
  });

  it('renders YAML the catalog loader accepts', () => {
    const parsed = ItemsFileSchema.parse(yaml.load(renderItemsYaml(result.items)));
    expect(parsed.items.length).toBe(result.items.length);
    expect(parsed.items.every((i) => i.id.startsWith('item_'))).toBe(true);
  });
});
