import type { RequestHandler } from './$types.js';
import { ok, parseIntId, parseRouteParam } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import { z } from 'zod';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as kitQ from '$lib/db/queries/trip-kit-components.js';

const IdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const POST: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  // Kits are addressed by catalog id (kits never come from free-text rows), plus
  // :person_id for a per-person kit. Numeric row ids are rejected here.
  const [rawItem, rawPerson] = (params.key ?? '').split(':');
  const itemId = parseRouteParam(rawItem, IdSchema, 'invalid_item_id');
  const personId = rawPerson === undefined ? '' : parseRouteParam(rawPerson, IdSchema, 'invalid_person_id');
  const componentId = parseRouteParam(params.componentId, IdSchema, 'invalid_component_id');

  const trip = await tripsQ.getById(locals.pool, tripId);
  if (!trip) throwSvelteError(new ApiError(404, 'trip_not_found'));

  const item = await itemsQ.getById(locals.pool, itemId);
  if (!item || !item.is_kit) throwSvelteError(new ApiError(404, 'kit_not_found'));
  const known = item.kit_contents?.some((c) => c.id === componentId);
  if (!known) throwSvelteError(new ApiError(404, 'component_not_found'));

  const row = await kitQ.toggleCheck(locals.pool, tripId, itemId, personId, componentId);
  return ok({ component: row });
};
