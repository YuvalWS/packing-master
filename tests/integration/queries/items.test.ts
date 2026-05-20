import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupSeededPool, teardownSeededPool, type SeededPool } from '../../helpers/seeded-pool.js';
import * as itemsQ from '../../../src/lib/db/queries/items.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });

describe('queries/items', () => {
  it('listAll returns all fixture items, with DSL JSON parsed', async () => {
    const rows = await itemsQ.listAll(s.pool);
    expect(rows.length).toBe(s.catalog.items.length);
    const complex = rows.find((r) => r.id === 'item_complex_nested');
    expect(complex).toBeDefined();
    expect(complex?.include_when).toBeTypeOf('object');
    expect(complex?.quantity).toBeTypeOf('object');
  });

  it('getById returns the item when present', async () => {
    const row = await itemsQ.getById(s.pool, 'item_kit');
    expect(row).not.toBeNull();
    expect(row?.is_kit).toBe(true);
    expect(row?.kit_contents?.length).toBeGreaterThan(0);
  });

  it('getById returns null when missing', async () => {
    expect(await itemsQ.getById(s.pool, 'no_such_item')).toBeNull();
  });

  it('existsById reflects presence', async () => {
    expect(await itemsQ.existsById(s.pool, 'item_always')).toBe(true);
    expect(await itemsQ.existsById(s.pool, 'no_such_item')).toBe(false);
  });
});
