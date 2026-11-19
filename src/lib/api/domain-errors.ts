import { ApiError, throwSvelteError } from './errors.js';
import { BackupError } from '$lib/server/backup.js';
import { SystemError } from '$lib/server/system.js';

const STATUS: Record<string, number> = {
  invalid_backup_name: 400,
  invalid_backup_file: 400,
  backup_not_found: 404,
  backup_from_newer_version: 409,
  unknown_columns: 409,
  updates_not_available: 409
};

/** Maps backup/system domain errors to API errors; rethrows anything else. */
export async function withDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BackupError || err instanceof SystemError) {
      throwSvelteError(
        new ApiError(STATUS[err.code] ?? 400, err.code, err.message !== err.code ? err.message : undefined)
      );
    }
    throw err;
  }
}
