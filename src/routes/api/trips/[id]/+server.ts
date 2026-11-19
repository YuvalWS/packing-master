import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import * as kitQ from '$lib/db/queries/trip-kit-components.js';
import * as peopleQ from '$lib/db/queries/people.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { applyRules } from '$lib/server/trip-rules.js';
import { TripPatchRequest } from '$lib/schemas/api/trip.js';

interface EnrichedItem {
  row_id: number;
  item_id: string | null;
  person_id: string | null;
  person_name: string | null;
  display_name: string;
  category: string | null;
  default_bag: string | null;
  is_kit: boolean;
  is_optional: boolean;
  kit_contents: { id: string; display_name: string; default_count: number }[] | null;
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

  const [rows, kitComponents, people] = await Promise.all([
    tripItemsQ.listByTrip(locals.pool, tripId),
    kitQ.listByTrip(locals.pool, tripId),
    peopleQ.listAll(locals.pool, true)
  ]);
  const names = new Map(people.map((p) => [p.id, p.display_name]));

  const catalogIds = [...new Set(rows.map((r) => r.item_id).filter((x): x is string => !!x))];
  const catalog = await Promise.all(catalogIds.map((id) => itemsQ.getById(locals.pool, id)));
  const byId = new Map(catalog.filter((c) => c).map((c) => [c!.id, c!]));

  const items: EnrichedItem[] = rows.map((r) => {
    const cat = r.item_id ? byId.get(r.item_id) : undefined;
    return {
      row_id: r.id,
      item_id: r.item_id,
      person_id: r.person_id || null,
      person_name: r.person_id ? (names.get(r.person_id) ?? r.person_id) : null,
      display_name: cat?.display_name ?? r.display_name_override ?? '(unnamed)',
      category: cat?.category ?? null,
      default_bag: cat?.default_bag ?? null,
      is_kit: cat?.is_kit ?? false,
      is_optional: cat?.is_optional ?? false,
      kit_contents: cat?.is_kit && cat.kit_contents ? cat.kit_contents : null,
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
  return ok(await withDomainErrors(() => applyRules(locals.pool, tripId, body)));
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  const deleted = await tripsQ.deleteById(locals.pool, tripId);
  if (!deleted) throwSvelteError(new ApiError(404, 'trip_not_found'));
  return ok({ deleted: true });
};
