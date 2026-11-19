import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { PersonCreateRequest } from '$lib/schemas/api/catalog.js';
import * as peopleQ from '$lib/db/queries/people.js';
import { createPerson } from '$lib/server/catalog.js';

export const GET: RequestHandler = async ({ locals, url }) => {
  const includeArchived = ['1', 'true'].includes(url.searchParams.get('include_archived') ?? '');
  return ok({ people: await peopleQ.listAll(locals.pool, includeArchived) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, PersonCreateRequest);
  const person = await withDomainErrors(() => createPerson(locals.pool, body));
  return ok({ person }, { status: 201 });
};
