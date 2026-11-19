import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { PreviewRequest } from '$lib/schemas/api/catalog.js';
import { preview } from '$lib/server/catalog.js';

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, PreviewRequest);
  return ok(await withDomainErrors(() => preview(locals.pool, body)));
};
