import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupSeededPool, teardownSeededPool, type SeededPool } from '../../helpers/seeded-pool.js';
import * as templatesQ from '../../../src/lib/db/queries/templates.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });

describe('queries/templates', () => {
  it('listAll returns all fixture templates', async () => {
    const rows = await templatesQ.listAll(s.pool);
    expect(rows.length).toBe(s.catalog.templates.length);
  });

  it('getById returns the template with default_parameters parsed', async () => {
    const target = s.catalog.templates[0]!;
    const row = await templatesQ.getById(s.pool, target.id);
    expect(row).not.toBeNull();
    expect(Array.isArray(row?.default_parameters)).toBe(true);
  });

  it('getById returns null when missing', async () => {
    expect(await templatesQ.getById(s.pool, 'no_such_template')).toBeNull();
  });
});
