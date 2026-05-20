import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as itemsQ from '$lib/db/queries/items.js';

export const GET: RequestHandler = async ({ locals, params }) => {
  const item = await itemsQ.getById(locals.pool, params.id ?? '');
  if (!item) throwSvelteError(new ApiError(404, 'item_not_found'));
  return ok({ item });
};
