import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { RegenerateRequest, type RemoveItemKey } from '$lib/schemas/api/regenerate.js';

const toKey = (k: RemoveItemKey): tripItemsQ.RemoveItem =>
  'item_id' in k ? { itemId: k.item_id, personId: k.person_id } : { rowId: k.row_id };

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const body = await parseBody(request, RegenerateRequest);

  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));

  const result = await tripItemsQ.removeAutoItems(locals.pool, tripId, body.remove_item_keys.map(toKey));
  if (result.blockedManual > 0) {
    throwSvelteError(
      new ApiError(400, 'cannot_remove_manual_item', { blocked: result.blockedManual })
    );
  }
  const kept = await tripItemsQ.adoptAutoItems(locals.pool, tripId, (body.keep_item_keys ?? []).map(toKey), false);
  const packed = await tripItemsQ.adoptAutoItems(locals.pool, tripId, (body.pack_item_keys ?? []).map(toKey), true);
  return ok({ deleted: result.deleted, kept, packed });
};
