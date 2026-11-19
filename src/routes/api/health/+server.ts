import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { APP_VERSION } from '$lib/server/version.js';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    await locals.pool.query('SELECT 1');
    return ok({ ok: true, version: APP_VERSION, db: 'ok' });
  } catch {
    return ok({ ok: false, version: APP_VERSION, db: 'unreachable' }, { status: 503 });
  }
};
