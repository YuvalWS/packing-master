import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { ok, parseBody, parseRouteParam } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { TemplatePatchRequest } from '$lib/schemas/api/catalog.js';
import { deleteTemplate, updateTemplate } from '$lib/server/catalog.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as templatesQ from '$lib/db/queries/templates.js';

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const GET: RequestHandler = async ({ locals, params }) => {
  const template = await templatesQ.getById(locals.pool, params.id ?? '');
  if (!template) throwSvelteError(new ApiError(404, 'template_not_found'));
  return ok({ template });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_template_id');
  const body = await parseBody(request, TemplatePatchRequest);
  return ok({ template: await withDomainErrors(() => updateTemplate(locals.pool, id, body)) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_template_id');
  await withDomainErrors(() => deleteTemplate(locals.pool, id));
  return ok({ deleted: true });
};
