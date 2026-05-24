import type { Page } from '@playwright/test';
import mysql from 'mysql2/promise';
import path from 'node:path';
import process from 'node:process';
import { runMigrations } from '../../src/lib/db/migrate.js';
import { createPool } from '../../src/lib/db/pool.js';
import { loadCatalog } from '../../src/lib/seed/load.js';
import { seedCatalog } from '../../src/lib/seed/seed.js';

function testDbConfig() {
  return {
    host: process.env.DB_TEST_HOST!,
    port: Number(process.env.DB_TEST_PORT),
    user: process.env.DB_TEST_USER!,
    password: process.env.DB_TEST_PASS!,
    database: process.env.DB_TEST_NAME!,
    multipleStatements: true
  };
}

export async function setupTestDb(): Promise<void> {
  await runMigrations('test');
  const pool = createPool('test');
  try {
    const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
    const catalog = await loadCatalog(fixturesDir);
    await seedCatalog(pool, catalog);
  } finally {
    await pool.end();
  }
}

async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
}

export async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForHydration(page);
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
  await waitForHydration(page);
}

export async function resetTrips(): Promise<void> {
  const conn = await mysql.createConnection(testDbConfig());
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE trip_kit_components');
    await conn.query('TRUNCATE TABLE trip_items');
    await conn.query('TRUNCATE TABLE trips');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await conn.end();
  }
}
