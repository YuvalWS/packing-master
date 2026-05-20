import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { TripItemPatchRequest } from '$lib/schemas/api/trip-item.js';

function resolveKey(raw: string | undefined): tripItemsQ.TripItemKey {
  if (!raw) throwSvelteError(new ApiError(400, 'invalid_key'));
  if (/^\d+$/.test(raw)) return { rowId: Number(raw) };
  if (/^[a-z][a-z0-9_]*$/.test(raw)) return { itemId: raw };
  throwSvelteError(new ApiError(400, 'invalid_key'));
}

async function requireTrip(pool: import('mysql2/promise').Pool, tripId: number) {
  const trip = await tripsQ.getById(pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const tripId = parseIntId(params.id);
  const key = resolveKey(params.key);
  const body = await parseBody(request, TripItemPatchRequest);
  await requireTrip(locals.pool, tripId);

  const existing = await tripItemsQ.getByKey(locals.pool, tripId, key);
  if (!existing) throwSvelteError(new ApiError(404, 'trip_item_not_found'));

  const updated = await tripItemsQ.updateOne(locals.pool, tripId, key, body);
  return ok({ item: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  const key = resolveKey(params.key);
  await requireTrip(locals.pool, tripId);

  const result = await tripItemsQ.deleteManual(locals.pool, tripId, key);
  if (result.notFound) throwSvelteError(new ApiError(404, 'trip_item_not_found'));
  if (result.blockedAuto) throwSvelteError(new ApiError(400, 'cannot_delete_auto_item'));
  return ok({ deleted: true });
};
