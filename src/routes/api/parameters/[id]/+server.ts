import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { ok, parseBody, parseRouteParam } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { ParameterPatchRequest } from '$lib/schemas/api/catalog.js';
import * as parametersQ from '$lib/db/queries/parameters.js';
import { deleteParameter, parameterUsage, updateParameter } from '$lib/server/catalog.js';

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const GET: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_parameter_id');
  const parameter = await parametersQ.getById(locals.pool, id);
  if (!parameter) throwSvelteError(new ApiError(404, 'parameter_not_found'));
  return ok({ parameter, used_by: await parameterUsage(locals.pool, id) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_parameter_id');
  const body = await parseBody(request, ParameterPatchRequest);
  return ok({ parameter: await withDomainErrors(() => updateParameter(locals.pool, id, body)) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_parameter_id');
  await withDomainErrors(() => deleteParameter(locals.pool, id));
  return ok({ deleted: true });
};
