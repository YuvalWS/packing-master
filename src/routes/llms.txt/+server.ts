import type { RequestHandler } from './$types.js';
import { llmsTxt } from '$lib/api/catalog.js';
import { APP_VERSION } from '$lib/server/version.js';

export const GET: RequestHandler = () =>
  new Response(llmsTxt(APP_VERSION), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
