import type { RequestHandler } from './$types.js';
import { ok } from '$lib/api/json.js';
import { getSystemInfo } from '$lib/server/system.js';

export const GET: RequestHandler = async () => ok(await getSystemInfo());
