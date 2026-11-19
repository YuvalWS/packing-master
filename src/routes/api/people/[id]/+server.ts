import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { ok, parseBody, parseRouteParam } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { PersonPatchRequest } from '$lib/schemas/api/catalog.js';
import * as peopleQ from '$lib/db/queries/people.js';
import { deletePerson, personUsage, updatePerson } from '$lib/server/catalog.js';

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const GET: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_person_id');
  const person = await peopleQ.getById(locals.pool, id);
  if (!person) throwSvelteError(new ApiError(404, 'person_not_found'));
  return ok({ person, used_by: await personUsage(locals.pool, id) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_person_id');
  const body = await parseBody(request, PersonPatchRequest);
  return ok({ person: await withDomainErrors(() => updatePerson(locals.pool, id, body)) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = parseRouteParam(params.id, Id, 'invalid_person_id');
  return ok(await withDomainErrors(() => deletePerson(locals.pool, id)));
};
