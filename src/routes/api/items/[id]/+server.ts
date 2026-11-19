import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { ok, parseBody, parseRouteParam } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { ItemPatchRequest } from '$lib/schemas/api/catalog.js';
import * as itemsQ from '$lib/db/queries/items.js';
import { deleteItem, updateItem } from '$lib/server/catalog.js';

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const GET: RequestHandler = async ({ locals, params }) => {
  const item = await itemsQ.getCatalogItem(locals.pool, params.id ?? '');
  if (!item) throwSvelteError(new ApiError(404, 'item_not_found'));
  return ok({ item });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_item_id');
  const body = await parseBody(request, ItemPatchRequest);
  return ok({ item: await withDomainErrors(() => updateItem(locals.pool, id, body)) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_item_id');
  return ok(await withDomainErrors(() => deleteItem(locals.pool, id)));
};
