import type { RequestHandler } from './$types.js';
import { ok, parseBody, parseIntId } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { TripItemPatchRequest } from '$lib/schemas/api/trip-item.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';

// {key}: a row id, an item id (when the item has one row on the trip), or item_id:person_id.
function resolveKey(raw: string | undefined): tripItemsQ.TripItemKey {
  if (!raw) throwSvelteError(new ApiError(400, 'invalid_key'));
  if (/^\d+$/.test(raw)) return { rowId: Number(raw) };
  const m = /^([a-z][a-z0-9_]*)(?::([a-z][a-z0-9_]*))?$/.exec(raw);
  if (m) return m[2] ? { itemId: m[1]!, personId: m[2] } : { itemId: m[1]! };
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

  const existing = await withDomainErrors(() => tripItemsQ.getByKey(locals.pool, tripId, key));
  if (!existing) throwSvelteError(new ApiError(404, 'trip_item_not_found'));

  const updated = await tripItemsQ.updateOne(locals.pool, tripId, { rowId: existing.id }, body);
  return ok({ item: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  const key = resolveKey(params.key);
  await requireTrip(locals.pool, tripId);

  const result = await withDomainErrors(() => tripItemsQ.deleteManual(locals.pool, tripId, key));
  if (result.notFound) throwSvelteError(new ApiError(404, 'trip_item_not_found'));
  if (result.blockedAuto) throwSvelteError(new ApiError(400, 'cannot_delete_auto_item'));
  return ok({ deleted: true });
};
