import type { Handle } from '@sveltejs/kit';
import process from 'node:process';
import { getPool, type PoolTarget } from '$lib/db/pool.js';

const target: PoolTarget = process.env.APP_DB_TARGET === 'test' ? 'test' : 'dev';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.pool = getPool(target);
  return resolve(event);
};
