import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import { CreateBackupRequest } from '$lib/schemas/api/backup.js';
import { backupDir, createBackup, listBackups } from '$lib/server/backup.js';

export const GET: RequestHandler = async () => {
  return ok({ backups: await listBackups(), dir: backupDir() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  // The body is optional: a bare POST makes a manual backup.
  const text = await request.text();
  let raw: unknown = {};
  if (text.trim() !== '') {
    try {
      raw = JSON.parse(text);
    } catch {
      throwSvelteError(new ApiError(400, 'invalid_json'));
    }
  }
  const parsed = CreateBackupRequest.safeParse(raw);
  if (!parsed.success) throwSvelteError(parsed.error);
  const backup = await createBackup(locals.pool, parsed.data.reason ?? 'manual');
  return ok({ backup }, { status: 201 });
};
