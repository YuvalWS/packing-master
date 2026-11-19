import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { requestCheck } from '$lib/server/system.js';

export const POST: RequestHandler = async () => {
  await withDomainErrors(requestCheck);
  return ok({ requested: true }, { status: 202 });
};
