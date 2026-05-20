import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import {
  GET as tripGet,
  PATCH as tripPatch
} from '../../../src/routes/api/trips/[id]/+server.js';
import * as tripItemsQ from '../../../src/lib/db/queries/trip-items.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

interface CreatedBody {
  trip: { id: number };
  items: { row_id: number; item_id: string | null; count: number }[];
}

async function createTrip(extra: Record<string, unknown> = {}): Promise<CreatedBody> {
  const res = await tripsCreate(
    buildEvent(s.pool, {
      method: 'POST',
      body: {
        name: 'Test trip',
        start_date: '2025-01-06',
        end_date: '2025-01-07',
        parameters: ['accom_a'],
        ...extra
      }
    })
  );
  return (await expectJson(res)) as CreatedBody;
}

interface PatchResp {
  trip: { id: number; start_date: string; context: { parameters: string[] } };
  diff: {
    added: { itemId: string; count: number }[];
    updated: { itemId: string; countPreserved: boolean }[];
    to_be_removed: { item_id: string; row_id: number | null; display_name: string; count: number }[];
  };
}

async function patchTrip(tripId: number, body: Record<string, unknown>): Promise<PatchResp> {
  const res = await tripPatch(
    buildEvent(s.pool, {
      method: 'PATCH',
      params: { id: String(tripId) },
      body
    })
  );
  return (await expectJson(res)) as PatchResp;
}

describe('PATCH /api/trips/[id]', () => {
  it('widening parameters surfaces and applies the added items', async () => {
    const t = await createTrip();
    const before = new Set(t.items.map((i) => i.item_id));
    const patched = await patchTrip(t.trip.id, { parameters: ['accom_a', 'env_a'] });
    expect(patched.diff.added.map((a) => a.itemId)).toEqual(
      expect.arrayContaining(['item_when_env_a', 'item_when_env_a_or_env_b'])
    );

    const after = await tripGet(buildEvent(s.pool, { params: { id: String(t.trip.id) } }));
    const afterBody = (await expectJson(after)) as { items: { item_id: string | null }[] };
    const afterIds = new Set(afterBody.items.map((i) => i.item_id));
    for (const id of before) expect(afterIds.has(id)).toBe(true);
    expect(afterIds.has('item_when_env_a')).toBe(true);
  });

  it('narrowing parameters lists removals but does not delete', async () => {
    const t = await createTrip({ parameters: ['accom_a', 'env_a'] });
    const patched = await patchTrip(t.trip.id, { parameters: ['accom_a'] });
    expect(patched.diff.to_be_removed.length).toBeGreaterThan(0);

    const after = await tripGet(buildEvent(s.pool, { params: { id: String(t.trip.id) } }));
    const afterBody = (await expectJson(after)) as { items: { item_id: string | null }[] };
    for (const removed of patched.diff.to_be_removed) {
      expect(afterBody.items.some((i) => i.item_id === removed.item_id)).toBe(true);
    }
  });

  it('preserves user-edited counts on regenerate', async () => {
    const t = await createTrip({
      start_date: '2025-01-06',
      end_date: '2025-01-12',
      parameters: ['accom_a']
    });
    const perDay = t.items.find((i) => i.item_id === 'item_per_day');
    expect(perDay).toBeDefined();

    await tripItemsQ.updateOne(s.pool, t.trip.id, { itemId: 'item_per_day' }, { count: 99 });

    const patched = await patchTrip(t.trip.id, {
      start_date: '2025-01-06',
      end_date: '2025-01-13'
    });
    const updated = patched.diff.updated.find((u) => u.itemId === 'item_per_day');
    expect(updated?.countPreserved).toBe(true);

    const after = await tripGet(buildEvent(s.pool, { params: { id: String(t.trip.id) } }));
    const afterBody = (await expectJson(after)) as {
      items: { item_id: string | null; count: number }[];
    };
    const perDayAfter = afterBody.items.find((i) => i.item_id === 'item_per_day');
    expect(perDayAfter?.count).toBe(99);
  });

  it('no-op patch returns empty diff buckets', async () => {
    const t = await createTrip();
    const patched = await patchTrip(t.trip.id, { name: t.trip.id ? 'Renamed' : 'x' });
    expect(patched.diff.added).toEqual([]);
    expect(patched.diff.to_be_removed).toEqual([]);
    expect(patched.diff.updated.every((u) => !u.countPreserved)).toBe(true);
  });

  it('returns 404 for missing trip', async () => {
    await expect(
      tripPatch(
        buildEvent(s.pool, {
          method: 'PATCH',
          params: { id: '999999' },
          body: { name: 'x' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
