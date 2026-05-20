import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import * as itemsQ from '$lib/db/queries/items.js';

export const GET: RequestHandler = async ({ locals }) => {
  const items = await itemsQ.listAll(locals.pool);
  return ok({ items });
};
