import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as templatesQ from '$lib/db/queries/templates.js';

export const GET: RequestHandler = async ({ locals, params }) => {
  const template = await templatesQ.getById(locals.pool, params.id ?? '');
  if (!template) throwSvelteError(new ApiError(404, 'template_not_found'));
  return ok({ template });
};
