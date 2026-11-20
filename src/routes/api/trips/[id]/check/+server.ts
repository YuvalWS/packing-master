import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { TripCheckRequest } from '$lib/schemas/api/trip-item.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const body = await parseBody(request, TripCheckRequest);
  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));
  const updated = await tripItemsQ.setChecked(locals.pool, tripId, body.row_ids, body.is_checked);
  return ok({ updated });
};
