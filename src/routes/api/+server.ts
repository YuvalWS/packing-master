import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { apiIndex } from '$lib/api/catalog.js';
import { APP_VERSION } from '$lib/server/version.js';

export const GET: RequestHandler = () => ok(apiIndex(APP_VERSION));
