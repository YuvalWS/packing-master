import type { Item } from '../schemas/item.js';
import type { Parameter } from '../schemas/parameter.js';
import type { Condition } from '../schemas/condition.js';
import type { QuantityFormula } from '../schemas/quantity.js';
import { evaluate } from './evaluator.js';
import { computeQuantity } from './quantity.js';
import { derive, type DerivedTrip } from './derived.js';

export interface GenerateInput {
  items: Item[];
  parameters: Parameter[];
  userParams: readonly string[];
  startISO: string;
  endISO: string;
  extraContext?: Record<string, unknown>;
}

export interface GeneratedItem {
  itemId: string;
  count: number;
  ruleSnapshot: {
    include_when: Condition;
    quantity: QuantityFormula;
  };
}

export interface GenerateResult {
  items: GeneratedItem[];
  derived: DerivedTrip;
  activeParams: string[];
}

function validateSingletons(parameters: Parameter[], active: ReadonlySet<string>): void {
  // A singleton category is one whose members are all marked is_singleton.
  const byCategory = new Map<string, Parameter[]>();
  for (const p of parameters) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  for (const [category, members] of byCategory) {
    if (members.length === 0) continue;
    const allSingleton = members.every((m) => m.is_singleton);
    if (!allSingleton) continue;
    const activeInCat = members.filter((m) => active.has(m.id)).map((m) => m.id);
    if (activeInCat.length !== 1) {
      throw new Error(
        `singleton category "${category}" requires exactly one active parameter, got ${activeInCat.length}: ${activeInCat.join(', ')}`
      );
    }
  }
}

export function generate(input: GenerateInput): GenerateResult {
  const derived = derive(input.startISO, input.endISO);
  const active = new Set<string>([...input.userParams, ...derived.derivedParamIds]);

  validateSingletons(input.parameters, active);

  const quantityCtx = {
    days: derived.days,
    weekdays: derived.weekdays,
    shabbatCount: derived.shabbatCount
  };

  const evalCtx = {
    activeParams: active,
    params: {
      days: derived.days,
      weekdays: derived.weekdays,
      weekends: derived.weekends,
      shabbatCount: derived.shabbatCount,
      ...(input.extraContext ?? {})
    }
  };

  const out: GeneratedItem[] = [];
  for (const item of input.items) {
    if (!evaluate(item.include_when, evalCtx)) continue;
    const count = computeQuantity(item.quantity, quantityCtx);
    if (count <= 0) continue;
    out.push({
      itemId: item.id,
      count,
      ruleSnapshot: {
        include_when: item.include_when,
        quantity: item.quantity
      }
    });
  }

  return {
    items: out,
    derived,
    activeParams: [...active].sort()
  };
}
