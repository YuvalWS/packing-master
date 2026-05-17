import type { GeneratedItem } from './generate.js';
import type { Condition } from '../schemas/condition.js';
import type { QuantityFormula } from '../schemas/quantity.js';

export interface TripItemRow {
  itemId: string;
  count: number;
  isManual: boolean;
  countWasEdited: boolean;
  ruleSnapshot?: {
    include_when: Condition;
    quantity: QuantityFormula;
  };
}

export interface MergeDiff {
  added: GeneratedItem[];
  updated: {
    itemId: string;
    previousCount: number;
    newCount: number;
    countPreserved: boolean;
    newRuleSnapshot: GeneratedItem['ruleSnapshot'];
  }[];
  toBeRemoved: TripItemRow[];
}

export function mergeIntoTrip(
  existing: readonly TripItemRow[],
  generated: readonly GeneratedItem[]
): MergeDiff {
  const existingById = new Map(existing.map((row) => [row.itemId, row]));
  const generatedById = new Map(generated.map((g) => [g.itemId, g]));

  const added: GeneratedItem[] = [];
  const updated: MergeDiff['updated'] = [];
  const toBeRemoved: TripItemRow[] = [];

  for (const g of generated) {
    const prev = existingById.get(g.itemId);
    if (!prev) {
      added.push(g);
      continue;
    }
    if (prev.isManual) continue;
    const countPreserved = prev.countWasEdited;
    updated.push({
      itemId: g.itemId,
      previousCount: prev.count,
      newCount: countPreserved ? prev.count : g.count,
      countPreserved,
      newRuleSnapshot: g.ruleSnapshot
    });
  }

  for (const row of existing) {
    if (row.isManual) continue;
    if (!generatedById.has(row.itemId)) {
      toBeRemoved.push(row);
    }
  }

  return { added, updated, toBeRemoved };
}
