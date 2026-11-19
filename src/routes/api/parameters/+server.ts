import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { ParameterCreateRequest } from '$lib/schemas/api/catalog.js';
import { createParameter } from '$lib/server/catalog.js';
import * as parametersQ from '$lib/db/queries/parameters.js';

export const GET: RequestHandler = async ({ locals }) => {
  const parameters = await parametersQ.listAll(locals.pool);
  return ok({ parameters });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, ParameterCreateRequest);
  const parameter = await withDomainErrors(() => createParameter(locals.pool, body));
  return ok({ parameter }, { status: 201 });
};
