import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import { POST as tripItemAdd } from '../../../src/routes/api/trips/[id]/items/+server.js';
import {
  PATCH as tripItemPatch,
  DELETE as tripItemDelete
} from '../../../src/routes/api/trips/[id]/items/[key]/+server.js';
import { PATCH as tripPatch } from '../../../src/routes/api/trips/[id]/+server.js';
import * as tripItemsQ from '../../../src/lib/db/queries/trip-items.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

interface CreatedTrip {
  trip: { id: number };
  items: { item_id: string | null; row_id: number; count: number }[];
}

async function createTrip(): Promise<CreatedTrip> {
  const res = await tripsCreate(
    buildEvent(s.pool, {
      method: 'POST',
      body: {
        start_date: '2025-01-06',
        end_date: '2025-01-12',
        parameters: ['accom_a']
      }
    })
  );
  return (await expectJson(res)) as CreatedTrip;
}

interface PatchBody {
  item: { id: number; count: number; is_checked: boolean; count_was_edited: boolean };
}

describe('PATCH /api/trips/[id]/items/[key]', () => {
  it('updating count flips count_was_edited and persists across a settings PATCH', async () => {
    const t = await createTrip();
    const res = await tripItemPatch(
      buildEvent(s.pool, {
        method: 'PATCH',
        params: { id: String(t.trip.id), key: 'item_per_day' },
        body: { count: 99 }
      })
    );
    const body = (await expectJson(res)) as PatchBody;
    expect(body.item.count).toBe(99);
    expect(body.item.count_was_edited).toBe(true);

    await tripPatch(
      buildEvent(s.pool, {
        method: 'PATCH',
        params: { id: String(t.trip.id) },
        body: { end_date: '2025-01-15' }
      })
    );
    const row = await tripItemsQ.getByKey(s.pool, t.trip.id, { itemId: 'item_per_day' });
    expect(row?.count).toBe(99);
  });

  it('toggling is_checked round-trips without touching count_was_edited', async () => {
    const t = await createTrip();
    const res = await tripItemPatch(
      buildEvent(s.pool, {
        method: 'PATCH',
        params: { id: String(t.trip.id), key: 'item_per_day' },
        body: { is_checked: true }
      })
    );
    const body = (await expectJson(res)) as PatchBody;
    expect(body.item.is_checked).toBe(true);
    expect(body.item.count_was_edited).toBe(false);
  });

  it('returns 404 for a key not present on the trip', async () => {
    const t = await createTrip();
    await expect(
      tripItemPatch(
        buildEvent(s.pool, {
          method: 'PATCH',
          params: { id: String(t.trip.id), key: 'item_not_in_trip' },
          body: { count: 1 }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('POST /api/trips/[id]/items (manual add)', () => {
  it('catalog variant inserts a manual row', async () => {
    const t = await createTrip();
    const res = await tripItemAdd(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(t.trip.id) },
        body: { item_id: 'item_when_env_a', count: 1 }
      })
    );
    expect(res.status).toBe(201);
    const body = (await expectJson(res)) as { item: { is_manual: boolean; item_id: string } };
    expect(body.item.is_manual).toBe(true);
    expect(body.item.item_id).toBe('item_when_env_a');
  });

  it('catalog variant 409s on duplicate item already in the trip', async () => {
    const t = await createTrip();
    await expect(
      tripItemAdd(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: String(t.trip.id) },
          body: { item_id: 'item_per_day' }
        })
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('catalog variant 404s on unknown item_id', async () => {
    const t = await createTrip();
    await expect(
      tripItemAdd(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: String(t.trip.id) },
          body: { item_id: 'item_does_not_exist' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('free-text variant inserts a row with item_id NULL and display_name_override', async () => {
    const t = await createTrip();
    const res = await tripItemAdd(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(t.trip.id) },
        body: { display_name: 'Custom thing', count: 2 }
      })
    );
    const body = (await expectJson(res)) as {
      item: {
        id: number;
        item_id: string | null;
        display_name_override: string | null;
        is_manual: boolean;
        count: number;
      };
    };
    expect(body.item.item_id).toBeNull();
    expect(body.item.display_name_override).toBe('Custom thing');
    expect(body.item.is_manual).toBe(true);
    expect(body.item.count).toBe(2);
  });
});

describe('DELETE /api/trips/[id]/items/[key]', () => {
  it('deletes a manual row', async () => {
    const t = await createTrip();
    const created = await tripItemAdd(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(t.trip.id) },
        body: { display_name: 'Manual thing' }
      })
    );
    const createdBody = (await expectJson(created)) as { item: { id: number } };
    const rowId = createdBody.item.id;
    const res = await tripItemDelete(
      buildEvent(s.pool, {
        method: 'DELETE',
        params: { id: String(t.trip.id), key: String(rowId) }
      })
    );
    expect(res.status).toBe(200);
    expect(await tripItemsQ.getByKey(s.pool, t.trip.id, { rowId })).toBeNull();
  });

  it('deletes a rule-generated row too (DESIGN.md 14.2)', async () => {
    const t = await createTrip();
    const res = await tripItemDelete(
      buildEvent(s.pool, {
        method: 'DELETE',
        params: { id: String(t.trip.id), key: 'item_per_day' }
      })
    );
    expect(res.status).toBe(200);
    expect(await tripItemsQ.getByKey(s.pool, t.trip.id, { itemId: 'item_per_day' })).toBeNull();
  });

  it('404s when the key is not on the trip', async () => {
    const t = await createTrip();
    await expect(
      tripItemDelete(
        buildEvent(s.pool, {
          method: 'DELETE',
          params: { id: String(t.trip.id), key: '999999' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
