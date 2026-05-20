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
import { POST as tripRegenerate } from '../../../src/routes/api/trips/[id]/regenerate/+server.js';
import * as tripItemsQ from '../../../src/lib/db/queries/trip-items.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

async function createTrip(parameters: string[]): Promise<{ id: number; rows: number }> {
  const res = await tripsCreate(
    buildEvent(s.pool, {
      method: 'POST',
      body: {
        start_date: '2025-01-06',
        end_date: '2025-01-12',
        parameters
      }
    })
  );
  const body = (await expectJson(res)) as { trip: { id: number }; items: unknown[] };
  return { id: body.trip.id, rows: body.items.length };
}

describe('POST /api/trips/[id]/regenerate', () => {
  it('commits the to_be_removed items from a narrowing patch', async () => {
    const t = await createTrip(['accom_a', 'env_a']);
    const patched = await tripPatch(
      buildEvent(s.pool, {
        method: 'PATCH',
        params: { id: String(t.id) },
        body: { parameters: ['accom_a'] }
      })
    );
    const patchedBody = (await expectJson(patched)) as {
      diff: { to_be_removed: { item_id: string }[] };
    };
    const removalKeys = patchedBody.diff.to_be_removed.map((r) => ({ item_id: r.item_id }));
    expect(removalKeys.length).toBeGreaterThan(0);

    const res = await tripRegenerate(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(t.id) },
        body: { remove_item_keys: removalKeys }
      })
    );
    const body = (await expectJson(res)) as { deleted: number };
    expect(body.deleted).toBe(removalKeys.length);

    const after = await tripGet(buildEvent(s.pool, { params: { id: String(t.id) } }));
    const afterBody = (await expectJson(after)) as { items: { item_id: string | null }[] };
    for (const k of removalKeys) {
      expect(afterBody.items.some((i) => i.item_id === k.item_id)).toBe(false);
    }
  });

  it('refuses to remove a manual row and keeps it', async () => {
    const t = await createTrip(['accom_a']);
    const manual = await tripItemsQ.insertManualFreeText(s.pool, t.id, {
      display_name: 'Manual thing',
      count: 1
    });
    expect(manual).not.toBeNull();

    await expect(
      tripRegenerate(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: String(t.id) },
          body: { remove_item_keys: [{ row_id: manual!.id }] }
        })
      )
    ).rejects.toMatchObject({ status: 400 });

    const stillThere = await tripItemsQ.getByKey(s.pool, t.id, { rowId: manual!.id });
    expect(stillThere).not.toBeNull();
  });

  it('is idempotent: missing keys count as deleted=0', async () => {
    const t = await createTrip(['accom_a']);
    const res = await tripRegenerate(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(t.id) },
        body: { remove_item_keys: [{ item_id: 'item_does_not_exist' }] }
      })
    );
    const body = (await expectJson(res)) as { deleted: number };
    expect(body.deleted).toBe(0);
  });

  it('returns 404 for missing trip', async () => {
    await expect(
      tripRegenerate(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: '999999' },
          body: { remove_item_keys: [] }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
