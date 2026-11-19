import type { Pool } from 'mysql2/promise';
import { ApiError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as parametersQ from '$lib/db/queries/parameters.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import * as peopleQ from '$lib/db/queries/people.js';
import { generate } from '$lib/rules/generate.js';
import { mergeIntoTrip, type TripItemRow } from '$lib/rules/merge.js';
import type { TripPatchRequest } from '$lib/schemas/api/trip.js';
import { requireTravelers, resolveTravelers } from './travelers.js';

/**
 * Applies new trip settings (or none: the trip's own, for a catalog re-apply) and merges
 * the regenerated list into the trip. Additions and count updates are written; removals
 * are only returned as `to_be_removed` (committed later via POST .../regenerate).
 */
export async function applyRules(pool: Pool, tripId: number, body: TripPatchRequest | null) {
  const existing = await tripsQ.getById(pool, tripId);
  if (!existing) throw new ApiError(404, 'trip_not_found');

  const nextParameters = body?.parameters ?? existing.context.parameters;
  const nextExtras = body?.extras !== undefined ? body.extras : existing.context.extras;
  const nextStart = body?.start_date ?? existing.start_date;
  const nextEnd = body?.end_date ?? existing.end_date;
  const nextTravelerIds = body?.travelers
    ? await requireTravelers(pool, body.travelers)
    : existing.travelers;
  const travelers = await resolveTravelers(pool, nextTravelerIds);

  const [items, parameters, existingItems] = await Promise.all([
    itemsQ.listAll(pool),
    parametersQ.listAll(pool),
    tripItemsQ.listByTrip(pool, tripId)
  ]);

  let generated;
  try {
    generated = generate({
      items,
      parameters,
      userParams: nextParameters,
      startISO: nextStart,
      endISO: nextEnd,
      extraContext: nextExtras,
      travelers
    });
  } catch (err) {
    throw new ApiError(400, 'generate_failed', err instanceof Error ? err.message : String(err));
  }

  const mergeInput: TripItemRow[] = existingItems
    .filter((r) => r.item_id !== null)
    .map((r) => ({
      itemId: r.item_id as string,
      personId: r.person_id,
      count: r.count,
      isManual: r.is_manual,
      countWasEdited: r.count_was_edited,
      ruleSnapshot: r.rule_snapshot ?? undefined
    }));

  const diff = mergeIntoTrip(mergeInput, generated.items);

  if (body) {
    await tripsQ.updateSettings(pool, tripId, {
      name: body.name,
      template_id: body.template_id,
      start_date: nextStart,
      end_date: nextEnd,
      destination: body.destination,
      context: { parameters: nextParameters, extras: nextExtras },
      travelers: nextTravelerIds
    });
  }

  await tripItemsQ.applyDiff(pool, tripId, diff);

  const trip = await tripsQ.getById(pool, tripId);
  // Archived items can still sit on the trip, so names come from the whole catalog.
  const catalogById = new Map((await itemsQ.listCatalog(pool, true)).map((i) => [i.id, i]));
  const rowKey = (itemId: string, personId: string) => `${itemId}|${personId}`;
  const existingByKey = new Map(
    existingItems.filter((r) => r.item_id).map((r) => [rowKey(r.item_id!, r.person_id), r])
  );
  const names = new Map((await peopleQ.listAll(pool, true)).map((p) => [p.id, p.display_name]));
  const who = (personId: string) => (personId ? { person_id: personId, person_name: names.get(personId) ?? personId } : { person_id: null, person_name: null });

  return {
    trip,
    diff: {
      added: diff.added.map((g) => ({
        item_id: g.itemId,
        ...who(g.personId),
        display_name: catalogById.get(g.itemId)?.display_name ?? g.itemId,
        count: g.count
      })),
      updated: diff.updated.map((u) => ({
        item_id: u.itemId,
        ...who(u.personId),
        display_name: catalogById.get(u.itemId)?.display_name ?? u.itemId,
        previous_count: u.previousCount,
        new_count: u.newCount,
        count_preserved: u.countPreserved
      })),
      to_be_removed: diff.toBeRemoved.map((r) => {
        const row = existingByKey.get(rowKey(r.itemId, r.personId));
        return {
          row_id: row?.id ?? null,
          item_id: r.itemId,
          ...who(r.personId),
          display_name: catalogById.get(r.itemId)?.display_name ?? r.itemId,
          count: r.count,
          is_checked: row?.is_checked ?? false
        };
      })
    }
  };
}
