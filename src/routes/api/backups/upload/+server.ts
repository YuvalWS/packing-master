import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { storeUploadedBackup } from '$lib/server/backup.js';

// Raw body (a .json.gz from GET /api/backups/:name, or plain JSON); not multipart.
export const POST: RequestHandler = async ({ request }) => {
  const data = Buffer.from(await request.arrayBuffer());
  const backup = await withDomainErrors(() => storeUploadedBackup(data));
  return ok({ backup }, { status: 201 });
};
