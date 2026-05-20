import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupSeededPool, teardownSeededPool, type SeededPool } from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { GET as itemsList } from '../../../src/routes/api/items/+server.js';
import { GET as itemById } from '../../../src/routes/api/items/[id]/+server.js';
import { GET as templatesList } from '../../../src/routes/api/templates/+server.js';
import { GET as templateById } from '../../../src/routes/api/templates/[id]/+server.js';
import { GET as parametersList } from '../../../src/routes/api/parameters/+server.js';

let s: SeededPool;

beforeAll(async () => { s = await setupSeededPool(); });
afterAll(async () => { await teardownSeededPool(s); });

describe('GET /api/items', () => {
  it('returns the seeded items', async () => {
    const res = await itemsList(buildEvent(s.pool));
    const body = (await expectJson(res)) as { items: { id: string }[] };
    expect(body.items.length).toBe(s.catalog.items.length);
  });
});

describe('GET /api/items/[id]', () => {
  it('returns one item', async () => {
    const res = await itemById(buildEvent(s.pool, { params: { id: 'item_always' } }));
    const body = (await expectJson(res)) as { item: { id: string } };
    expect(body.item.id).toBe('item_always');
  });

  it('returns 404 on missing item', async () => {
    await expect(itemById(buildEvent(s.pool, { params: { id: 'no_such_item' } }))).rejects.toMatchObject({
      status: 404
    });
  });
});

describe('GET /api/templates', () => {
  it('returns the seeded templates', async () => {
    const res = await templatesList(buildEvent(s.pool));
    const body = (await expectJson(res)) as { templates: unknown[] };
    expect(body.templates.length).toBe(s.catalog.templates.length);
  });
});

describe('GET /api/templates/[id]', () => {
  it('returns one template', async () => {
    const target = s.catalog.templates[0]!;
    const res = await templateById(buildEvent(s.pool, { params: { id: target.id } }));
    const body = (await expectJson(res)) as { template: { id: string } };
    expect(body.template.id).toBe(target.id);
  });

  it('returns 404 on missing template', async () => {
    await expect(
      templateById(buildEvent(s.pool, { params: { id: 'no_such_template' } }))
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('GET /api/parameters', () => {
  it('returns the seeded parameters', async () => {
    const res = await parametersList(buildEvent(s.pool));
    const body = (await expectJson(res)) as { parameters: unknown[] };
    expect(body.parameters.length).toBe(s.catalog.parameters.length);
  });
});
