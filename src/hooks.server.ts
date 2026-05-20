import type { Handle } from '@sveltejs/kit';
import { getPool } from '$lib/db/pool.js';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.pool = getPool('dev');
  return resolve(event);
};
