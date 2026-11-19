import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { restoreBackup } from '$lib/server/backup.js';

export const POST: RequestHandler = async ({ locals, params }) => {
  const result = await withDomainErrors(() => restoreBackup(locals.pool, params.name));
  return ok(result);
};
