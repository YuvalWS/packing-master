import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { TripItemAddRequest } from '$lib/schemas/api/trip-item.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const body = await parseBody(request, TripItemAddRequest);

  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));

  let row;
  if ('item_id' in body) {
    if (!(await itemsQ.existsById(locals.pool, body.item_id))) {
      throwSvelteError(new ApiError(404, 'item_not_found'));
    }
    if (body.person_id && !(trip.travelers ?? []).includes(body.person_id)) {
      throwSvelteError(new ApiError(400, 'person_not_on_trip'));
    }
    const existing = await tripItemsQ.getByKey(locals.pool, tripId, {
      itemId: body.item_id,
      personId: body.person_id ?? ''
    });
    if (existing) {
      throwSvelteError(new ApiError(409, 'item_already_in_trip'));
    }
    row = await tripItemsQ.insertManualCatalog(locals.pool, tripId, body);
  } else {
    row = await tripItemsQ.insertManualFreeText(locals.pool, tripId, body);
  }
  return ok({ item: row }, { status: 201 });
};
