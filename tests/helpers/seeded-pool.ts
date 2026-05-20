import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'mysql2/promise';
import { createPool } from '../../src/lib/db/pool.js';
import { runMigrations } from '../../src/lib/db/migrate.js';
import { loadCatalog, type Catalog } from '../../src/lib/seed/load.js';
import { seedCatalog } from '../../src/lib/seed/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');

export interface SeededPool {
  pool: Pool;
  catalog: Catalog;
}

export async function setupSeededPool(): Promise<SeededPool> {
  await runMigrations('test');
  const pool = createPool('test');
  const catalog = await loadCatalog(FIXTURES);
  await seedCatalog(pool, catalog);
  return { pool, catalog };
}

export async function teardownSeededPool(p: SeededPool | undefined): Promise<void> {
  if (p?.pool) await p.pool.end();
}

export async function resetTripData(pool: Pool): Promise<void> {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE trip_kit_components');
  await pool.query('TRUNCATE TABLE trip_items');
  await pool.query('TRUNCATE TABLE trips');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}
