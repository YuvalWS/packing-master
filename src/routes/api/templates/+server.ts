import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import * as templatesQ from '$lib/db/queries/templates.js';

export const GET: RequestHandler = async ({ locals }) => {
  const templates = await templatesQ.listAll(locals.pool);
  return ok({ templates });
};
