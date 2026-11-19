import type { Handle, ServerInit } from '@sveltejs/kit';
import process from 'node:process';
import { getPool, type PoolTarget } from '$lib/db/pool.js';
import { runMigrations } from '$lib/db/migrate.js';

const target: PoolTarget = process.env.APP_DB_TARGET === 'test' ? 'test' : 'dev';

// Production (deploy/compose.yml) sets RUN_MIGRATIONS=1 so an update needs no manual step.
export const init: ServerInit = async () => {
  if (process.env.RUN_MIGRATIONS === '1') {
    for (let attempt = 1; ; attempt++) {
      try {
        await runMigrations(target);
        return;
      } catch (err) {
        // MySQL can still be starting when the app container comes up.
        if (attempt >= 30) throw err;
        console.warn(`migrations: database not ready (attempt ${attempt}), retrying`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.pool = getPool(target);
  return resolve(event);
};
