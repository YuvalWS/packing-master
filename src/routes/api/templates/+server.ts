import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { TemplateCreateRequest } from '$lib/schemas/api/catalog.js';
import { createTemplate } from '$lib/server/catalog.js';
import * as templatesQ from '$lib/db/queries/templates.js';

export const GET: RequestHandler = async ({ locals }) => {
  const templates = await templatesQ.listAll(locals.pool);
  return ok({ templates });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, TemplateCreateRequest);
  const template = await withDomainErrors(() => createTemplate(locals.pool, body));
  return ok({ template }, { status: 201 });
};
