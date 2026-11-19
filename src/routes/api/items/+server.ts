import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { ItemCreateRequest } from '$lib/schemas/api/catalog.js';
import * as itemsQ from '$lib/db/queries/items.js';
import { createItem } from '$lib/server/catalog.js';

export const GET: RequestHandler = async ({ locals, url }) => {
  const includeArchived = ['1', 'true'].includes(url.searchParams.get('include_archived') ?? '');
  return ok({ items: await itemsQ.listCatalog(locals.pool, includeArchived) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, ItemCreateRequest);
  const item = await withDomainErrors(() => createItem(locals.pool, body));
  return ok({ item }, { status: 201 });
};
