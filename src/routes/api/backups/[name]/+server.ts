import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { deleteBackup, readBackupFile } from '$lib/server/backup.js';

export const GET: RequestHandler = async ({ params }) => {
  const data = await withDomainErrors(() => readBackupFile(params.name));
  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': 'application/gzip',
      'content-disposition': `attachment; filename="${params.name}"`,
      'content-length': String(data.length)
    }
  });
};

export const DELETE: RequestHandler = async ({ params }) => {
  await withDomainErrors(() => deleteBackup(params.name));
  return ok({ deleted: true });
};
