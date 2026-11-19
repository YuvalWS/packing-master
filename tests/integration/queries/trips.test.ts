import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import * as tripsQ from '../../../src/lib/db/queries/trips.js';
import * as tripItemsQ from '../../../src/lib/db/queries/trip-items.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

describe('queries/trips', () => {
  it('create + getById round-trip', async () => {
    const id = await tripsQ.create(s.pool, {
      name: 'Test trip',
      start_date: '2025-01-01',
      end_date: '2025-01-07',
      destination: null,
      context: { parameters: ['accom_a', 'env_a'], extras: { hot: true } }
    });
    const row = await tripsQ.getById(s.pool, id);
    expect(row?.name).toBe('Test trip');
    expect(row?.start_date).toBe('2025-01-01');
    expect(row?.end_date).toBe('2025-01-07');
    expect(row?.context.parameters).toEqual(['accom_a', 'env_a']);
    expect(row?.context.extras).toEqual({ hot: true });
  });

  it('listAll sorts by start_date DESC', async () => {
    await tripsQ.create(s.pool, {
      start_date: '2025-01-01',
      end_date: '2025-01-02',
      context: { parameters: [] }
    });
    await tripsQ.create(s.pool, {
      start_date: '2025-03-01',
      end_date: '2025-03-02',
      context: { parameters: [] }
    });
    const rows = await tripsQ.listAll(s.pool);
    expect(rows[0]?.start_date).toBe('2025-03-01');
    expect(rows[1]?.start_date).toBe('2025-01-01');
  });

  it('listAll reports item_count and checked_count per trip', async () => {
    const id = await tripsQ.create(s.pool, {
      start_date: '2025-01-01',
      end_date: '2025-01-03',
      context: { parameters: ['accom_a'] }
    });
    await tripItemsQ.insertGeneratedAll(s.pool, id, [
      {
        itemId: 'item_always',
        personId: '',
        count: 1,
        ruleSnapshot: { include_when: true, quantity: { fixed: 1 } }
      },
      {
        itemId: 'item_per_day',
        personId: '',
        count: 3,
        ruleSnapshot: { include_when: true, quantity: { per_day: 1 } }
      }
    ]);
    await tripItemsQ.updateOne(s.pool, id, { itemId: 'item_always' }, { is_checked: true });

    const rows = await tripsQ.listAll(s.pool);
    const row = rows.find((r) => r.id === id);
    expect(row?.item_count).toBe(2);
    expect(row?.checked_count).toBe(1);
  });

  it('listAll reports zero counts for an empty trip', async () => {
    const id = await tripsQ.create(s.pool, {
      start_date: '2025-02-01',
      end_date: '2025-02-02',
      context: { parameters: [] }
    });
    const rows = await tripsQ.listAll(s.pool);
    const row = rows.find((r) => r.id === id);
    expect(row?.item_count).toBe(0);
    expect(row?.checked_count).toBe(0);
  });

  it('updateSettings patches only provided fields', async () => {
    const id = await tripsQ.create(s.pool, {
      name: 'before',
      start_date: '2025-01-01',
      end_date: '2025-01-07',
      context: { parameters: ['accom_a'] }
    });
    await tripsQ.updateSettings(s.pool, id, { name: 'after' });
    const row = await tripsQ.getById(s.pool, id);
    expect(row?.name).toBe('after');
    expect(row?.start_date).toBe('2025-01-01');
  });

  it('deleteById removes the trip', async () => {
    const id = await tripsQ.create(s.pool, {
      start_date: '2025-01-01',
      end_date: '2025-01-02',
      context: { parameters: [] }
    });
    expect(await tripsQ.deleteById(s.pool, id)).toBe(true);
    expect(await tripsQ.getById(s.pool, id)).toBeNull();
  });

  it('getById returns null for missing trip', async () => {
    expect(await tripsQ.getById(s.pool, 999_999)).toBeNull();
  });
});
