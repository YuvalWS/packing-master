import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import { POST as toggleComponent } from '../../../src/routes/api/trips/[id]/items/[key]/components/[componentId]/+server.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });
beforeEach(async () => { await resetTripData(s.pool); });

async function createTrip(): Promise<number> {
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
  const body = (await expectJson(res)) as { trip: { id: number } };
  return body.trip.id;
}

interface ToggleResp {
  component: {
    trip_id: number;
    kit_item_id: string;
    component_id: string;
    is_checked: boolean;
  };
}

async function toggle(
  tripId: number,
  itemId: string,
  componentId: string
): Promise<ToggleResp['component']> {
  const res = await toggleComponent(
    buildEvent(s.pool, {
      method: 'POST',
      params: { id: String(tripId), key: itemId, componentId }
    })
  );
  return ((await expectJson(res)) as ToggleResp).component;
}

describe('POST /api/trips/[id]/items/[key]/components/[componentId]', () => {
  it('toggles from unchecked to checked to unchecked', async () => {
    const tripId = await createTrip();
    const first = await toggle(tripId, 'item_kit', 'kit_comp_one');
    expect(first.is_checked).toBe(true);
    const second = await toggle(tripId, 'item_kit', 'kit_comp_one');
    expect(second.is_checked).toBe(false);
  });

  it('keeps state independent across trips and components', async () => {
    const a = await createTrip();
    const b = await createTrip();
    const aRow = await toggle(a, 'item_kit', 'kit_comp_one');
    expect(aRow.is_checked).toBe(true);

    const bRow = await toggle(b, 'item_kit', 'kit_comp_one');
    expect(bRow.is_checked).toBe(true);
    expect(bRow.trip_id).toBe(b);

    const bOther = await toggle(b, 'item_kit', 'kit_comp_two');
    expect(bOther.is_checked).toBe(true);
    expect(bOther.component_id).toBe('kit_comp_two');
  });

  it('404s for a non-kit item', async () => {
    const tripId = await createTrip();
    await expect(
      toggleComponent(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: String(tripId), key: 'item_always', componentId: 'kit_comp_one' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s for an unknown component on a real kit', async () => {
    const tripId = await createTrip();
    await expect(
      toggleComponent(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: String(tripId), key: 'item_kit', componentId: 'no_such_component' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s for missing trip', async () => {
    await expect(
      toggleComponent(
        buildEvent(s.pool, {
          method: 'POST',
          params: { id: '999999', key: 'item_kit', componentId: 'kit_comp_one' }
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
