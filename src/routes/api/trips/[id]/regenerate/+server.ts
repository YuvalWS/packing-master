import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { RegenerateRequest } from '$lib/schemas/api/regenerate.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const body = await parseBody(request, RegenerateRequest);

  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));

  const keys = body.remove_item_keys.map((k) =>
    'item_id' in k ? { itemId: k.item_id } : { rowId: k.row_id }
  );

  const result = await tripItemsQ.removeAutoItems(locals.pool, tripId, keys);
  if (result.blockedManual > 0) {
    throwSvelteError(
      new ApiError(400, 'cannot_remove_manual_item', { blocked: result.blockedManual })
    );
  }
  return ok({ deleted: result.deleted });
};
