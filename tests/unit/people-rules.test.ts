import { describe, it, expect } from 'vitest';
import { generate, rowsFor } from '../../src/lib/rules/generate.js';
import { evaluate, type Traveler } from '../../src/lib/rules/evaluator.js';
import { mergeIntoTrip } from '../../src/lib/rules/merge.js';
import type { Item } from '../../src/lib/schemas/item.js';
import type { Parameter } from '../../src/lib/schemas/parameter.js';

const FAMILY: Traveler[] = [
  { id: 'dad', kind: 'adult' },
  { id: 'mom', kind: 'adult' },
  { id: 'baby', kind: 'baby' }
];

const PARAMS: Parameter[] = [
  { id: 'accom_a', display_name: 'A', category: 'accommodation', is_singleton: true, is_derived: false, sort_order: 0 }
];

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    display_name: id,
    per: 'family',
    split: true,
    is_optional: false,
    is_kit: false,
    include_when: true,
    quantity: { fixed: 2 },
    ...extra
  };
}

function gen(items: Item[], travelers: Traveler[] | undefined) {
  // 2025-03-04 (Tue) .. 2025-03-06 (Thu): 3 days.
  return generate({
    items,
    parameters: PARAMS,
    userParams: ['accom_a'],
    startISO: '2025-03-04',
    endISO: '2025-03-06',
    travelers
  }).items.map((g) => [g.itemId, g.personId, g.count]);
}

describe('rowsFor', () => {
  it('gives one shared row per family, or for trips without people', () => {
    expect(rowsFor(item('x'), FAMILY)).toEqual([{ personId: '', times: 1 }]);
    expect(rowsFor(item('x', { per: 'person', person_id: 'dad' }), undefined)).toEqual([
      { personId: '', times: 1 }
    ]);
  });

  it('splits per person, per kind, or sums into one row', () => {
    expect(rowsFor(item('x', { per: 'person' }), FAMILY).map((r) => r.personId)).toEqual(['dad', 'mom', 'baby']);
    expect(rowsFor(item('x', { per: 'adult' }), FAMILY).map((r) => r.personId)).toEqual(['dad', 'mom']);
    expect(rowsFor(item('x', { per: 'person', split: false }), FAMILY)).toEqual([{ personId: '', times: 3 }]);
    expect(rowsFor(item('x', { per: 'kid' }), FAMILY)).toEqual([]);
  });

  it('ties an item to one person, only when they come', () => {
    expect(rowsFor(item('x', { person_id: 'baby', per: 'family' }), FAMILY)).toEqual([
      { personId: 'baby', times: 1 }
    ]);
    expect(rowsFor(item('x', { person_id: 'baby' }), FAMILY.slice(0, 2))).toEqual([]);
  });
});

describe('generate with travelers', () => {
  it('produces per-person rows, summed rows and person-tied rows', () => {
    const rows = gen(
      [
        item('tent'),
        item('socks', { per: 'person', quantity: { per_day: 1 } }),
        item('food', { per: 'person', split: false, quantity: { per_day: 2 } }),
        item('diapers', { per: 'baby', quantity: { per_day: 6 } }),
        item('glasses', { person_id: 'mom', quantity: { fixed: 1 } })
      ],
      FAMILY
    );
    expect(rows).toEqual([
      ['tent', '', 2],
      ['socks', 'dad', 3],
      ['socks', 'mom', 3],
      ['socks', 'baby', 3],
      ['food', '', 18],
      ['diapers', 'baby', 18],
      ['glasses', 'mom', 1]
    ]);
  });

  it('leaves out kind-scoped items when nobody of that kind comes', () => {
    expect(gen([item('diapers', { per: 'baby' })], FAMILY.slice(0, 2))).toEqual([]);
  });

  it('keeps the old single-row behaviour for trips without people', () => {
    expect(gen([item('socks', { per: 'person', quantity: { per_day: 1 } })], undefined)).toEqual([
      ['socks', '', 3]
    ]);
  });
});

describe('person and kind conditions', () => {
  const ctx = (travelers?: Traveler[]) => ({ activeParams: new Set<string>(), params: {}, travelers });

  it('tests who is coming', () => {
    expect(evaluate({ person: 'baby' }, ctx(FAMILY))).toBe(true);
    expect(evaluate({ person: 'grandma' }, ctx(FAMILY))).toBe(false);
    expect(evaluate({ kind: 'baby' }, ctx(FAMILY))).toBe(true);
    expect(evaluate({ kind: 'kid' }, ctx(FAMILY))).toBe(false);
    expect(evaluate({ and: [{ kind: 'baby' }, { not: { person: 'dad' } }] }, ctx(FAMILY))).toBe(false);
  });

  it('is false for trips without people', () => {
    expect(evaluate({ kind: 'adult' }, ctx(undefined))).toBe(false);
  });
});

describe('merge keyed by item and person', () => {
  const snap = { include_when: true as const, quantity: { fixed: 1 } };
  it('adds a new traveler\'s rows and proposes removing a departed one\'s', () => {
    const diff = mergeIntoTrip(
      [
        { itemId: 'socks', personId: 'dad', count: 3, isManual: false, countWasEdited: false },
        { itemId: 'socks', personId: 'mom', count: 3, isManual: false, countWasEdited: true }
      ],
      [
        { itemId: 'socks', personId: 'mom', count: 4, ruleSnapshot: snap },
        { itemId: 'socks', personId: 'baby', count: 4, ruleSnapshot: snap }
      ]
    );
    expect(diff.added.map((a) => a.personId)).toEqual(['baby']);
    expect(diff.updated).toMatchObject([{ personId: 'mom', newCount: 3, countPreserved: true }]);
    expect(diff.toBeRemoved.map((r) => r.personId)).toEqual(['dad']);
  });
});

describe('yom_tov and holiday conditions', () => {
  it('see the holidays in the trip dates', () => {
    const run = (start: string, end: string, when: Item['include_when']) =>
      generate({
        items: [item('x', { include_when: when })],
        parameters: PARAMS,
        userParams: ['accom_a'],
        startISO: start,
        endISO: end
      }).items.length === 1;
    expect(run('2027-06-10', '2027-06-12', { yom_tov: true })).toBe(true);
    expect(run('2027-06-10', '2027-06-12', { holiday: 'shavuot' })).toBe(true);
    expect(run('2026-12-04', '2026-12-06', { holiday: 'chanukah' })).toBe(true);
    expect(run('2026-11-20', '2026-11-22', { holiday: 'chanukah' })).toBe(false);
    expect(run('2026-11-20', '2026-11-22', { yom_tov: true })).toBe(false);
  });
});
