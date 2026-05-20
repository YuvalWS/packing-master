import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as parametersQ from '$lib/db/queries/parameters.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import * as kitQ from '$lib/db/queries/trip-kit-components.js';
import { generate } from '$lib/rules/generate.js';
import { mergeIntoTrip, type TripItemRow } from '$lib/rules/merge.js';
import { TripPatchRequest } from '$lib/schemas/api/trip.js';

interface EnrichedItem {
  row_id: number;
  item_id: string | null;
  display_name: string;
  category: string | null;
  default_bag: string | null;
  is_kit: boolean;
  is_optional: boolean;
  count: number;
  is_checked: boolean;
  is_manual: boolean;
  bag_distribution: Record<string, unknown> | null;
  notes: string | null;
  count_was_edited: boolean;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));

  const [rows, kitComponents] = await Promise.all([
    tripItemsQ.listByTrip(locals.pool, tripId),
    kitQ.listByTrip(locals.pool, tripId)
  ]);

  const catalogIds = [...new Set(rows.map((r) => r.item_id).filter((x): x is string => !!x))];
  const catalog = await Promise.all(catalogIds.map((id) => itemsQ.getById(locals.pool, id)));
  const byId = new Map(catalog.filter((c) => c).map((c) => [c!.id, c!]));

  const items: EnrichedItem[] = rows.map((r) => {
    const cat = r.item_id ? byId.get(r.item_id) : undefined;
    return {
      row_id: r.id,
      item_id: r.item_id,
      display_name: cat?.display_name ?? r.display_name_override ?? '(unnamed)',
      category: cat?.category ?? null,
      default_bag: cat?.default_bag ?? null,
      is_kit: cat?.is_kit ?? false,
      is_optional: cat?.is_optional ?? false,
      count: r.count,
      is_checked: r.is_checked,
      is_manual: r.is_manual,
      bag_distribution: r.bag_distribution,
      notes: r.notes,
      count_was_edited: r.count_was_edited
    };
  });

  return ok({ trip, items, kit_components: kitComponents });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const body = await parseBody(request, TripPatchRequest);

  const existing = await tripsQ.getById(locals.pool, tripId);
  if (!existing) throwSvelteError(new ApiError(404, 'trip_not_found'));

  const nextParameters = body.parameters ?? existing.context.parameters;
  const nextExtras =
    body.extras !== undefined ? body.extras : existing.context.extras;
  const nextStart = body.start_date ?? existing.start_date;
  const nextEnd = body.end_date ?? existing.end_date;

  const [items, parameters, existingItems] = await Promise.all([
    itemsQ.listAll(locals.pool),
    parametersQ.listAll(locals.pool),
    tripItemsQ.listByTrip(locals.pool, tripId)
  ]);

  let generated;
  try {
    generated = generate({
      items,
      parameters,
      userParams: nextParameters,
      startISO: nextStart,
      endISO: nextEnd,
      extraContext: nextExtras
    });
  } catch (err) {
    throwSvelteError(
      new ApiError(400, 'generate_failed', err instanceof Error ? err.message : String(err))
    );
  }

  const mergeInput: TripItemRow[] = existingItems
    .filter((r) => r.item_id !== null)
    .map((r) => ({
      itemId: r.item_id as string,
      count: r.count,
      isManual: r.is_manual,
      countWasEdited: r.count_was_edited,
      ruleSnapshot: r.rule_snapshot ?? undefined
    }));

  const diff = mergeIntoTrip(mergeInput, generated.items);

  await tripsQ.updateSettings(locals.pool, tripId, {
    name: body.name,
    template_id: body.template_id,
    start_date: nextStart,
    end_date: nextEnd,
    destination: body.destination,
    context: { parameters: nextParameters, extras: nextExtras },
    travelers: body.travelers
  });

  await tripItemsQ.applyDiff(locals.pool, tripId, diff);

  const trip = await tripsQ.getById(locals.pool, tripId);
  const removedById = new Map(existingItems.map((r) => [r.item_id ?? `__row_${r.id}`, r]));
  const toBeRemoved = diff.toBeRemoved.map((r) => {
    const row = removedById.get(r.itemId);
    const cat = items.find((i) => i.id === r.itemId);
    return {
      row_id: row?.id ?? null,
      item_id: r.itemId,
      display_name: cat?.display_name ?? r.itemId,
      count: r.count
    };
  });

  return ok({
    trip,
    diff: {
      added: diff.added,
      updated: diff.updated,
      to_be_removed: toBeRemoved
    }
  });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  const deleted = await tripsQ.deleteById(locals.pool, tripId);
  if (!deleted) throwSvelteError(new ApiError(404, 'trip_not_found'));
  return ok({ deleted: true });
};
