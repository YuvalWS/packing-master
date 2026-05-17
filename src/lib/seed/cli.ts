import path from 'node:path';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { createPool, type PoolTarget } from '../db/pool.js';
import { loadCatalog } from './load.js';
import { seedCatalog } from './seed.js';

async function main() {
  const target = process.argv[2] as PoolTarget | undefined;
  const dir = process.argv[3];

  if ((target !== 'dev' && target !== 'test') || !dir) {
    console.error('usage: tsx src/lib/seed/cli.ts <dev|test> <yaml-dir>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), dir);
  if (!existsSync(resolved)) {
    console.error(`directory not found: ${resolved}`);
    process.exit(1);
  }

  console.log(`loading catalog from ${resolved}`);
  const catalog = await loadCatalog(resolved);
  console.log(
    `loaded: ${catalog.parameters.length} parameters, ${catalog.items.length} items, ${catalog.templates.length} templates`
  );

  const pool = createPool(target);
  try {
    await seedCatalog(pool, catalog);
    console.log(`seeded ${target} database`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
