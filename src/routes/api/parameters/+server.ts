import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import * as parametersQ from '$lib/db/queries/parameters.js';

export const GET: RequestHandler = async ({ locals }) => {
  const parameters = await parametersQ.listAll(locals.pool);
  return ok({ parameters });
};
