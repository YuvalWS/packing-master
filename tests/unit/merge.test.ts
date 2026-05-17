import { describe, expect, it } from 'vitest';
import { mergeIntoTrip, type TripItemRow } from '../../src/lib/rules/merge.js';
import type { GeneratedItem } from '../../src/lib/rules/generate.js';

const gi = (itemId: string, count: number): GeneratedItem => ({
  itemId,
  count,
  ruleSnapshot: { include_when: true, quantity: { fixed: count } }
});

const row = (
  itemId: string,
  count: number,
  opts: Partial<TripItemRow> = {}
): TripItemRow => ({
  itemId,
  count,
  isManual: false,
  countWasEdited: false,
  ...opts
});

describe('mergeIntoTrip — added', () => {
  it('returns generated items not in existing as added', () => {
    const diff = mergeIntoTrip([], [gi('a', 1), gi('b', 2)]);
    expect(diff.added.map((g) => g.itemId)).toEqual(['a', 'b']);
    expect(diff.updated).toEqual([]);
    expect(diff.toBeRemoved).toEqual([]);
  });
});

describe('mergeIntoTrip — updated, count not edited', () => {
  it('updates count to newly generated value', () => {
    const diff = mergeIntoTrip([row('a', 3)], [gi('a', 7)]);
    expect(diff.added).toEqual([]);
    expect(diff.toBeRemoved).toEqual([]);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]).toMatchObject({
      itemId: 'a',
      previousCount: 3,
      newCount: 7,
      countPreserved: false
    });
  });
});

describe('mergeIntoTrip — updated, count edited', () => {
  it('preserves user-edited count', () => {
    const diff = mergeIntoTrip(
      [row('a', 99, { countWasEdited: true })],
      [gi('a', 7)]
    );
    expect(diff.updated[0]).toMatchObject({
      itemId: 'a',
      previousCount: 99,
      newCount: 99,
      countPreserved: true
    });
  });
});

describe('mergeIntoTrip — toBeRemoved', () => {
  it('lists non-manual existing items no longer generated', () => {
    const diff = mergeIntoTrip(
      [row('a', 1), row('b', 2)],
      [gi('a', 1)]
    );
    expect(diff.toBeRemoved).toHaveLength(1);
    expect(diff.toBeRemoved[0]?.itemId).toBe('b');
  });
});

describe('mergeIntoTrip — manual items are untouched', () => {
  it('manual items never appear in updated even when in generated', () => {
    const diff = mergeIntoTrip(
      [row('a', 1, { isManual: true })],
      [gi('a', 5)]
    );
    expect(diff.updated).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.toBeRemoved).toEqual([]);
  });

  it('manual items never appear in toBeRemoved when not in generated', () => {
    const diff = mergeIntoTrip(
      [row('manual_only', 1, { isManual: true }), row('a', 1)],
      [gi('a', 1)]
    );
    expect(diff.toBeRemoved).toEqual([]);
  });
});

describe('mergeIntoTrip — combined scenario', () => {
  it('handles all three buckets at once', () => {
    const existing: TripItemRow[] = [
      row('keep_same', 2),
      row('keep_edited', 99, { countWasEdited: true }),
      row('remove_me', 1),
      row('manual_keep', 1, { isManual: true }),
      row('manual_orphan', 1, { isManual: true })
    ];
    const generated: GeneratedItem[] = [
      gi('keep_same', 5), // updated, not edited → 5
      gi('keep_edited', 5), // updated, edited → 99 preserved
      gi('manual_keep', 5), // skipped (manual)
      gi('new_item', 1) // added
    ];
    const diff = mergeIntoTrip(existing, generated);
    expect(diff.added.map((g) => g.itemId)).toEqual(['new_item']);
    expect(diff.updated.map((u) => u.itemId).sort()).toEqual(['keep_edited', 'keep_same']);
    expect(diff.toBeRemoved.map((r) => r.itemId)).toEqual(['remove_me']);

    const same = diff.updated.find((u) => u.itemId === 'keep_same')!;
    const edited = diff.updated.find((u) => u.itemId === 'keep_edited')!;
    expect(same.newCount).toBe(5);
    expect(same.countPreserved).toBe(false);
    expect(edited.newCount).toBe(99);
    expect(edited.countPreserved).toBe(true);
  });
});

describe('mergeIntoTrip — rule snapshot refresh', () => {
  it('updated items receive the new ruleSnapshot', () => {
    const newRule = gi('a', 4);
    const diff = mergeIntoTrip(
      [row('a', 1, { ruleSnapshot: { include_when: 'old', quantity: { fixed: 1 } } })],
      [newRule]
    );
    expect(diff.updated[0]?.newRuleSnapshot).toEqual(newRule.ruleSnapshot);
  });
});
