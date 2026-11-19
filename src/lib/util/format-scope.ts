import type { Item } from '$lib/schemas/item.js';
import strings from '$lib/strings.js';

/** "For whom" summary of an item's scope (DESIGN.md 13). */
export function formatScope(
  item: Pick<Item, 'per' | 'split' | 'person_id'>,
  names?: ReadonlyMap<string, string>
): string {
  if (item.person_id) {
    return strings.scope.for_person.replace('{name}', names?.get(item.person_id) ?? item.person_id);
  }
  const base = strings.scope[item.per];
  if (item.per === 'family') return base;
  return `${base} · ${item.split ? strings.scope.split : strings.scope.combined}`;
}
