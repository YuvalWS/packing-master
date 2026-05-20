import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { GET as tripsList, POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import {
  GET as tripGet,
  DELETE as tripDelete
} from '../../../src/routes/api/trips/[id]/+server.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

interface CreatedBody {
  trip: { id: number };
  items: { row_id: number; item_id: string | null }[];
}

async function createTrip(extra: Record<string, unknown> = {}): Promise<CreatedBody> {
  const res = await tripsCreate(
    buildEvent(s.pool, {
      method: 'POST',
      body: {
        name: 'Test trip',
        start_date: '2025-01-01',
        end_date: '2025-01-07',
        parameters: ['accom_a', 'env_a', 'plan_a'],
        ...extra
      }
    })
  );
  expect(res.status).toBe(201);
  return (await expectJson(res)) as CreatedBody;
}

describe('POST /api/trips', () => {
  it('creates a trip and inserts generated items', async () => {
    const body = await createTrip();
    expect(body.trip.id).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.item_id !== null)).toBe(true);
  });

  it('rejects an invalid body', async () => {
    await expect(
      tripsCreate(buildEvent(s.pool, { method: 'POST', body: { start_date: 'nope' } }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when singleton constraint fails (no accommodation)', async () => {
    await expect(
      tripsCreate(
        buildEvent(s.pool, {
          method: 'POST',
          body: {
            start_date: '2025-01-01',
            end_date: '2025-01-07',
            parameters: ['env_a']
          }
        })
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('GET /api/trips', () => {
  it('lists trips most recent first', async () => {
    const a = await createTrip({ start_date: '2025-01-01', end_date: '2025-01-02' });
    const b = await createTrip({ start_date: '2025-03-01', end_date: '2025-03-02' });
    const res = await tripsList(buildEvent(s.pool));
    const body = (await expectJson(res)) as { trips: { id: number; start_date: string }[] };
    expect(body.trips[0]?.id).toBe(b.trip.id);
    expect(body.trips[1]?.id).toBe(a.trip.id);
  });
});

describe('GET /api/trips/[id]', () => {
  it('returns the trip with enriched items', async () => {
    const created = await createTrip();
    const res = await tripGet(
      buildEvent(s.pool, { params: { id: String(created.trip.id) } })
    );
    const body = (await expectJson(res)) as {
      trip: { id: number };
      items: { display_name: string; is_kit: boolean }[];
      kit_components: unknown[];
    };
    expect(body.trip.id).toBe(created.trip.id);
    expect(body.items.length).toBe(created.items.length);
    expect(body.items.every((i) => typeof i.display_name === 'string')).toBe(true);
    expect(Array.isArray(body.kit_components)).toBe(true);
  });

  it('returns 404 for missing trip', async () => {
    await expect(
      tripGet(buildEvent(s.pool, { params: { id: '999999' } }))
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('DELETE /api/trips/[id]', () => {
  it('deletes the trip and its items via cascade', async () => {
    const created = await createTrip();
    const res = await tripDelete(
      buildEvent(s.pool, { method: 'DELETE', params: { id: String(created.trip.id) } })
    );
    expect(res.status).toBe(200);
    await expect(
      tripGet(buildEvent(s.pool, { params: { id: String(created.trip.id) } }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when deleting missing trip', async () => {
    await expect(
      tripDelete(buildEvent(s.pool, { method: 'DELETE', params: { id: '999999' } }))
    ).rejects.toMatchObject({ status: 404 });
  });
});
