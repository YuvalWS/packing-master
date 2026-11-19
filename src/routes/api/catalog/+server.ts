import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { exportCatalog } from '$lib/server/catalog.js';

export const GET: RequestHandler = async ({ locals }) => ok(await exportCatalog(locals.pool));
