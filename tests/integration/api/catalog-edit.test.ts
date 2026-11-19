import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { seedCatalog } from '../../../src/lib/seed/seed.js';
import { GET as itemsList, POST as itemCreate } from '../../../src/routes/api/items/+server.js';
import {
  GET as itemGet,
  PATCH as itemPatch,
  DELETE as itemDelete
} from '../../../src/routes/api/items/[id]/+server.js';
import { POST as templateCreate } from '../../../src/routes/api/templates/+server.js';
import {
  PATCH as templatePatch,
  DELETE as templateDelete
} from '../../../src/routes/api/templates/[id]/+server.js';
import { POST as parameterCreate } from '../../../src/routes/api/parameters/+server.js';
import {
  GET as parameterGet,
  PATCH as parameterPatch,
  DELETE as parameterDelete
} from '../../../src/routes/api/parameters/[id]/+server.js';
import { GET as catalogGet } from '../../../src/routes/api/catalog/+server.js';
import { POST as preview } from '../../../src/routes/api/catalog/preview/+server.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import { GET as tripGet } from '../../../src/routes/api/trips/[id]/+server.js';
import { POST as reapply } from '../../../src/routes/api/trips/[id]/reapply/+server.js';
import { PATCH as tripItemPatch } from '../../../src/routes/api/trips/[id]/items/[key]/+server.js';

let s: SeededPool;

beforeAll(async () => {
  s = await setupSeededPool();
});
afterAll(async () => {
  await seedCatalog(s.pool, s.catalog);
  await teardownSeededPool(s);
});
beforeEach(async () => {
  await resetTripData(s.pool);
  await seedCatalog(s.pool, s.catalog);
});

const post = (body: unknown, params: Record<string, string> = {}) =>
  buildEvent(s.pool, { method: 'POST', body, params });
const patch = (params: Record<string, string>, body: unknown) =>
  buildEvent(s.pool, { method: 'PATCH', body, params });
const del = (params: Record<string, string>) => buildEvent(s.pool, { method: 'DELETE', params });

const BABY_WIPES = {
  id: 'baby_wipes',
  display_name: 'Baby wipes',
  category: 'baby',
  include_when: 'env_a',
  quantity: { per_n_days: { n: 2, min: 1 } }
};

async function makeTrip(parameters = ['accom_a', 'env_a', 'plan_a']): Promise<number> {
  const res = await tripsCreate(
    post({ start_date: '2025-03-06', end_date: '2025-03-09', parameters })
  );
  return ((await expectJson(res)) as { trip: { id: number } }).trip.id;
}

async function tripItems(id: number) {
  const body = (await expectJson(await tripGet(buildEvent(s.pool, { params: { id: String(id) } })))) as {
    items: { item_id: string | null; count: number }[];
  };
  return body.items;
}

describe('items', () => {
  it('creates, reads, patches and lists an item', async () => {
    const res = await itemCreate(post(BABY_WIPES));
    expect(res.status).toBe(201);
    const created = ((await expectJson(res)) as { item: Record<string, unknown> }).item;
    expect(created).toMatchObject({ id: 'baby_wipes', is_optional: false, archived: false });

    const patched = (await expectJson(
      await itemPatch(patch({ id: 'baby_wipes' }, { quantity: { fixed: 3 }, category: null }))
    )) as { item: Record<string, unknown> };
    expect(patched.item.quantity).toEqual({ fixed: 3 });
    expect(patched.item.category).toBeUndefined();

    const got = (await expectJson(await itemGet(buildEvent(s.pool, { params: { id: 'baby_wipes' } })))) as {
      item: { display_name: string };
    };
    expect(got.item.display_name).toBe('Baby wipes');
  });

  it('rejects duplicates, unknown parameters and invalid kits', async () => {
    await expect(itemCreate(post({ ...BABY_WIPES, id: 'item_always' }))).rejects.toMatchObject({
      status: 409
    });
    await expect(
      itemCreate(post({ ...BABY_WIPES, include_when: { any_param: ['env_a', 'no_such'] } }))
    ).rejects.toMatchObject({ status: 400, body: { error: 'unknown_parameter' } });
    await expect(itemCreate(post({ ...BABY_WIPES, is_kit: true }))).rejects.toMatchObject({
      status: 400
    });
    await expect(
      itemPatch(patch({ id: 'item_always' }, { include_when: 'no_such' }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it('deletes an unused item and archives a used one', async () => {
    await itemCreate(post(BABY_WIPES));
    const gone = (await expectJson(await itemDelete(del({ id: 'baby_wipes' })))) as Record<string, unknown>;
    expect(gone).toEqual({ deleted: true });

    const trip = await makeTrip();
    const res = (await expectJson(await itemDelete(del({ id: 'item_when_env_a' })))) as {
      archived: boolean;
      used_by_trips: number[];
    };
    expect(res).toEqual({ archived: true, used_by_trips: [trip] });

    const visible = (await expectJson(await itemsList(buildEvent(s.pool)))) as { items: { id: string }[] };
    expect(visible.items.map((i) => i.id)).not.toContain('item_when_env_a');
    const all = (await expectJson(
      await itemsList(buildEvent(s.pool, { url: 'http://localhost/api/items?include_archived=1' }))
    )) as { items: { id: string; archived: boolean }[] };
    expect(all.items.find((i) => i.id === 'item_when_env_a')?.archived).toBe(true);

    // The trip keeps its row; a new trip no longer gets the item.
    expect((await tripItems(trip)).map((i) => i.item_id)).toContain('item_when_env_a');
    const fresh = await makeTrip();
    expect((await tripItems(fresh)).map((i) => i.item_id)).not.toContain('item_when_env_a');

    await itemPatch(patch({ id: 'item_when_env_a' }, { archived: false }));
    const restored = await makeTrip();
    expect((await tripItems(restored)).map((i) => i.item_id)).toContain('item_when_env_a');
  });
});

describe('preview and reapply', () => {
  it('previews a draft rule against explicit settings and a trip', async () => {
    const draft = { ...BABY_WIPES, quantity: { per_day: 6 } };
    const a = (await expectJson(
      await preview(
        post({ item: draft, start_date: '2025-03-06', end_date: '2025-03-08', parameters: ['accom_a', 'env_a'] })
      )
    )) as { included: boolean; count: number; derived: { days: number } };
    expect(a).toMatchObject({ included: true, count: 18, derived: { days: 3 } });

    const trip = await makeTrip(['accom_a', 'env_b']);
    const b = (await expectJson(await preview(post({ item: draft, trip_id: trip })))) as {
      included: boolean;
    };
    expect(b.included).toBe(false);

    await expect(preview(post({ item_id: 'item_always' }))).rejects.toMatchObject({ status: 400 });
  });

  it('reapplies catalog changes to a trip without touching user edits', async () => {
    const trip = await makeTrip();
    // A user-edited count must survive a rule change.
    await tripItemPatch(
      buildEvent(s.pool, { method: 'PATCH', params: { id: String(trip), key: 'item_per_day' }, body: { count: 99 } })
    );
    await itemCreate(post(BABY_WIPES));
    await itemPatch(patch({ id: 'item_per_day' }, { quantity: { fixed: 1 } }));
    await itemPatch(patch({ id: 'item_when_env_a' }, { include_when: 'env_b' }));

    const res = (await expectJson(await reapply(post({}, { id: String(trip) })))) as {
      diff: {
        added: { item_id: string }[];
        updated: { item_id: string; count_preserved: boolean }[];
        to_be_removed: { item_id: string }[];
      };
    };
    expect(res.diff.added.map((a) => a.item_id)).toEqual(['baby_wipes']);
    expect(res.diff.to_be_removed.map((r) => r.item_id)).toEqual(['item_when_env_a']);
    const items = await tripItems(trip);
    expect(items.find((i) => i.item_id === 'item_per_day')?.count).toBe(99);
    expect(items.map((i) => i.item_id)).toContain('item_when_env_a');
  });
});

describe('templates and parameters', () => {
  it('manages templates with parameter checks', async () => {
    const t = { id: 'tpl_new', display_name: 'New', default_parameters: ['accom_a', 'env_a'] };
    expect((await templateCreate(post(t))).status).toBe(201);
    await expect(templateCreate(post(t))).rejects.toMatchObject({ status: 409 });
    await expect(
      templatePatch(patch({ id: 'tpl_new' }, { default_parameters: ['accom_a', 'derived_long_trip'] }))
    ).rejects.toMatchObject({ status: 400, body: { error: 'derived_parameter_not_allowed' } });
    const p = (await expectJson(
      await templatePatch(patch({ id: 'tpl_new' }, { default_parameters: ['accom_b'] }))
    )) as { template: { default_parameters: string[] } };
    expect(p.template.default_parameters).toEqual(['accom_b']);
    await templateDelete(del({ id: 'tpl_new' }));
    await expect(templateDelete(del({ id: 'tpl_new' }))).rejects.toMatchObject({ status: 404 });
  });

  it('manages parameters and refuses to delete one in use', async () => {
    const res = await parameterCreate(
      post({ id: 'env_baby', display_name: 'With baby', category: 'environment' })
    );
    expect(((await expectJson(res)) as { parameter: { is_singleton: boolean } }).parameter.is_singleton).toBe(false);
    const acc = (await expectJson(
      await parameterPatch(patch({ id: 'env_baby' }, { category: 'accommodation' }))
    )) as { parameter: { is_singleton: boolean } };
    expect(acc.parameter.is_singleton).toBe(true);
    await parameterPatch(patch({ id: 'env_baby' }, { category: 'environment' }));

    await itemCreate(post({ ...BABY_WIPES, include_when: 'env_baby' }));
    const usage = (await expectJson(await parameterGet(buildEvent(s.pool, { params: { id: 'env_baby' } })))) as {
      used_by: { items: string[] };
    };
    expect(usage.used_by.items).toEqual(['baby_wipes']);
    await expect(parameterDelete(del({ id: 'env_baby' }))).rejects.toMatchObject({
      status: 409,
      body: { error: 'parameter_in_use' }
    });
    await itemDelete(del({ id: 'baby_wipes' }));
    expect(await expectJson(await parameterDelete(del({ id: 'env_baby' })))).toEqual({ deleted: true });

    await expect(
      parameterPatch(patch({ id: 'derived_long_trip' }, { display_name: 'x' }))
    ).rejects.toMatchObject({ status: 400, body: { error: 'derived_parameter_readonly' } });
  });

  it('exports the live catalog in the seed shape', async () => {
    const body = (await expectJson(await catalogGet(buildEvent(s.pool)))) as {
      parameters: unknown[];
      items: Record<string, unknown>[];
      templates: unknown[];
    };
    expect(body.parameters).toHaveLength(s.catalog.parameters.length);
    expect(body.items).toHaveLength(s.catalog.items.length);
    expect(body.items[0]).not.toHaveProperty('archived');
  });
});
