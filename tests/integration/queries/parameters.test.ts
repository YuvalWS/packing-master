import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupSeededPool, teardownSeededPool, type SeededPool } from '../../helpers/seeded-pool.js';
import * as parametersQ from '../../../src/lib/db/queries/parameters.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });

describe('queries/parameters', () => {
  it('listAll returns all fixture parameters', async () => {
    const rows = await parametersQ.listAll(s.pool);
    expect(rows.length).toBe(s.catalog.parameters.length);
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(s.catalog.parameters.map((p) => p.id))
    );
  });

  it('listAll is sorted by category then sort_order', async () => {
    const rows = await parametersQ.listAll(s.pool);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      if (prev.category === cur.category) {
        expect(prev.sort_order <= cur.sort_order).toBe(true);
      } else {
        expect(prev.category < cur.category || prev.category === cur.category).toBe(true);
      }
    }
  });

  it('getById returns the parameter when present', async () => {
    const target = s.catalog.parameters[0]!;
    const row = await parametersQ.getById(s.pool, target.id);
    expect(row).not.toBeNull();
    expect(row?.display_name).toBe(target.display_name);
  });

  it('getById returns null when missing', async () => {
    expect(await parametersQ.getById(s.pool, 'no_such_param')).toBeNull();
  });
});
