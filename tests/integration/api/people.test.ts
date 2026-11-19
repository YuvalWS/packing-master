import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mysql from 'mysql2/promise';
import { gzipSync } from 'node:zlib';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { seedCatalog } from '../../../src/lib/seed/seed.js';
import { runMigrations } from '../../../src/lib/db/migrate.js';
import { decodeBackup, exportSnapshot, restoreSnapshot } from '../../../src/lib/server/backup.js';
import { GET as peopleList, POST as personCreate } from '../../../src/routes/api/people/+server.js';
import {
  GET as personGet,
  PATCH as personPatch,
  DELETE as personDelete
} from '../../../src/routes/api/people/[id]/+server.js';
import { POST as itemCreate } from '../../../src/routes/api/items/+server.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import { GET as tripGet, PATCH as tripPatch } from '../../../src/routes/api/trips/[id]/+server.js';
import { PATCH as rowPatch } from '../../../src/routes/api/trips/[id]/items/[key]/+server.js';
import { POST as regenerate } from '../../../src/routes/api/trips/[id]/regenerate/+server.js';
import { POST as preview } from '../../../src/routes/api/catalog/preview/+server.js';

let s: SeededPool;

const post = (body: unknown, params: Record<string, string> = {}) =>
  buildEvent(s.pool, { method: 'POST', body, params });

async function resetPeople() {
  await s.pool.query('DELETE FROM people');
}

beforeAll(async () => {
  s = await setupSeededPool();
});
afterAll(async () => {
  await resetTripData(s.pool);
  await seedCatalog(s.pool, s.catalog);
  await resetPeople();
  await teardownSeededPool(s);
});
beforeEach(async () => {
  await resetTripData(s.pool);
  await seedCatalog(s.pool, s.catalog);
  await resetPeople();
});

async function addFamily() {
  for (const p of [
    { id: 'dad', display_name: 'Dad', kind: 'adult', sort_order: 1 },
    { id: 'mom', display_name: 'Mom', kind: 'adult', sort_order: 2 },
    { id: 'baby', display_name: 'Baby', kind: 'baby', sort_order: 3 }
  ]) {
    expect((await personCreate(post(p))).status).toBe(201);
  }
  await itemCreate(post({ id: 'socks', display_name: 'Socks', per: 'person', include_when: true, quantity: { per_day: 1 } }));
  await itemCreate(post({ id: 'diapers', display_name: 'Diapers', per: 'baby', include_when: true, quantity: { per_day: 6 } }));
  await itemCreate(post({ id: 'water', display_name: 'Water', per: 'person', split: false, include_when: true, quantity: { fixed: 2 } }));
}

interface Row {
  row_id: number;
  item_id: string | null;
  person_id: string | null;
  person_name: string | null;
  count: number;
}

async function rows(id: number): Promise<Row[]> {
  const body = (await expectJson(await tripGet(buildEvent(s.pool, { params: { id: String(id) } })))) as {
    items: Row[];
  };
  return body.items;
}

async function makeTrip(extra: Record<string, unknown> = {}): Promise<number> {
  const res = await tripsCreate(
    post({ start_date: '2025-03-04', end_date: '2025-03-06', parameters: ['accom_a', 'env_a', 'plan_a'], ...extra })
  );
  return ((await expectJson(res)) as { trip: { id: number } }).trip.id;
}

describe('people API', () => {
  it('creates, lists, patches and archives or deletes people', async () => {
    await addFamily();
    const list = (await expectJson(await peopleList(buildEvent(s.pool)))) as { people: { id: string }[] };
    expect(list.people.map((p) => p.id)).toEqual(['dad', 'mom', 'baby']);
    await expect(personCreate(post({ id: 'dad', display_name: 'x', kind: 'adult' }))).rejects.toMatchObject({ status: 409 });

    const grown = (await expectJson(
      await personPatch(buildEvent(s.pool, { method: 'PATCH', params: { id: 'baby' }, body: { kind: 'kid' } }))
    )) as { person: { kind: string } };
    expect(grown.person.kind).toBe('kid');

    await personCreate(post({ id: 'guest', display_name: 'Guest', kind: 'adult' }));
    expect(await expectJson(await personDelete(buildEvent(s.pool, { method: 'DELETE', params: { id: 'guest' } })))).toEqual({ deleted: true });

    const trip = await makeTrip();
    const res = (await expectJson(
      await personDelete(buildEvent(s.pool, { method: 'DELETE', params: { id: 'mom' } }))
    )) as { archived: boolean; used_by: { trips: number[] } };
    expect(res).toMatchObject({ archived: true, used_by: { trips: [trip] } });
    const usage = (await expectJson(await personGet(buildEvent(s.pool, { params: { id: 'mom' } })))) as {
      person: { archived: boolean };
    };
    expect(usage.person.archived).toBe(true);
  });

  it('refuses items tied to unknown people', async () => {
    await expect(
      itemCreate(post({ id: 'x', display_name: 'x', person_id: 'nobody', include_when: true, quantity: { fixed: 1 } }))
    ).rejects.toMatchObject({ status: 400, body: { error: 'unknown_person' } });
    await expect(
      itemCreate(post({ id: 'y', display_name: 'y', include_when: { person: 'nobody' }, quantity: { fixed: 1 } }))
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('trips with travelers', () => {
  it('takes everyone by default and makes per-person, per-kind and summed rows', async () => {
    await addFamily();
    const id = await makeTrip();
    const list = await rows(id);
    const of = (itemId: string) => list.filter((r) => r.item_id === itemId).map((r) => [r.person_id, r.count]);
    expect(of('socks')).toEqual([['dad', 3], ['mom', 3], ['baby', 3]]);
    expect(of('diapers')).toEqual([['baby', 18]]);
    expect(of('water')).toEqual([[null, 6]]);
    expect(list.find((r) => r.person_id === 'mom')?.person_name).toBe('Mom');
  });

  it('changing travelers adds rows at once and proposes removals', async () => {
    await addFamily();
    const id = await makeTrip({ travelers: ['dad', 'baby'] });
    const res = (await expectJson(
      await tripPatch(buildEvent(s.pool, { method: 'PATCH', params: { id: String(id) }, body: { travelers: ['dad', 'mom'] } }))
    )) as {
      diff: {
        added: { item_id: string; person_id: string | null }[];
        to_be_removed: { row_id: number; item_id: string; person_id: string | null }[];
      };
    };
    expect(res.diff.added.filter((a) => a.item_id === 'socks').map((a) => a.person_id)).toEqual(['mom']);
    expect(res.diff.to_be_removed.map((r) => [r.item_id, r.person_id]).sort()).toEqual([
      ['diapers', 'baby'],
      ['socks', 'baby']
    ]);
    await regenerate(post({ remove_item_keys: res.diff.to_be_removed.map((r) => ({ row_id: r.row_id })) }, { id: String(id) }));
    expect((await rows(id)).some((r) => r.person_id === 'baby')).toBe(false);
  });

  it('addresses rows by row id, item:person, or a unique item id', async () => {
    await addFamily();
    const id = await makeTrip();
    const patch = (key: string, body: unknown) =>
      rowPatch(buildEvent(s.pool, { method: 'PATCH', params: { id: String(id), key }, body }));
    await expect(patch('socks', { is_checked: true })).rejects.toMatchObject({
      status: 409,
      body: { error: 'ambiguous_item_key' }
    });
    const mom = (await expectJson(await patch('socks:mom', { count: 7 }))) as { item: { count: number; person_id: string } };
    expect(mom.item).toMatchObject({ count: 7, person_id: 'mom' });
    expect((await patch('diapers', { is_checked: true })).status).toBe(200);
  });

  it('previews a rule for given travelers', async () => {
    await addFamily();
    const res = (await expectJson(
      await preview(
        post({
          item: { id: 'draft', display_name: 'x', per: 'adult', include_when: { kind: 'baby' }, quantity: { fixed: 1 } },
          start_date: '2025-03-04',
          end_date: '2025-03-06',
          parameters: ['accom_a'],
          travelers: ['dad', 'mom', 'baby']
        })
      )
    )) as { included: boolean; count: number; rows: { person_id: string }[] };
    expect(res).toMatchObject({ included: true, count: 2 });
    expect(res.rows.map((r) => r.person_id)).toEqual(['dad', 'mom']);
  });
});

describe('migration 0004 and old backups (workflow rule 9)', () => {
  it('converts a pre-0004 database: personal items tied to owner, old trips unchanged', async () => {
    const admin = await mysql.createConnection({
      host: process.env.DB_TEST_HOST,
      port: Number(process.env.DB_TEST_PORT),
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PASS,
      multipleStatements: true
    });
    const db = 'packing_migration_test';
    await admin.query(`DROP DATABASE IF EXISTS ${db}; CREATE DATABASE ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    try {
      await runMigrations('test', { database: db, to: '0003_item_archive.sql' });
      await admin.query(`USE ${db}`);
      await admin.query(`
        INSERT INTO items (id, display_name, is_shared, include_when, quantity)
          VALUES ('tent', 'Tent', TRUE, 'true', '{"fixed":1}'), ('socks', 'Socks', FALSE, 'true', '{"per_day":1}');
        INSERT INTO trips (id, start_date, end_date, context) VALUES (1, '2025-03-04', '2025-03-06', '{"parameters":[]}');
        INSERT INTO trip_items (trip_id, item_id, count) VALUES (1, 'tent', 1), (1, 'socks', 3);
      `);
      await runMigrations('test', { database: db });

      const [items] = await admin.query<mysql.RowDataPacket[]>('SELECT id, per, person_id FROM items ORDER BY id');
      expect(items.map((r) => [r.id, r.per, r.person_id])).toEqual([
        ['socks', 'person', 'owner'],
        ['tent', 'family', null]
      ]);
      const [people] = await admin.query<mysql.RowDataPacket[]>('SELECT id, kind FROM people');
      expect(people.map((r) => [r.id, r.kind])).toEqual([['owner', 'adult']]);
      const [tripRows] = await admin.query<mysql.RowDataPacket[]>('SELECT item_id, person_id FROM trip_items ORDER BY item_id');
      expect(tripRows.map((r) => [r.item_id, r.person_id])).toEqual([['socks', 'owner'], ['tent', '']]);
      const [trips] = await admin.query<mysql.RowDataPacket[]>('SELECT travelers FROM trips');
      const travelers = trips[0]!.travelers;
      expect(typeof travelers === 'string' ? JSON.parse(travelers) : travelers).toEqual(['owner']);
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${db}`);
      await admin.end();
    }
  });

  it('restores a backup taken before 0004', async () => {
    const current = await exportSnapshot(s.pool);
    const legacy = {
      ...current,
      migrations: current.migrations.filter((m) => m < '0004'),
      tables: {
        parameters: current.tables.parameters,
        items: [
          { id: 'tent', display_name: 'Tent', category: null, default_bag: null, is_shared: 1, is_optional: 0, is_kit: 0, kit_contents: null, include_when: true, quantity: { fixed: 1 }, notes: null, archived_at: null },
          { id: 'socks', display_name: 'Socks', category: null, default_bag: null, is_shared: 0, is_optional: 0, is_kit: 0, kit_contents: null, include_when: true, quantity: { per_day: 1 }, notes: null, archived_at: null }
        ],
        templates: [],
        trips: [{ id: 5, name: null, template_id: null, start_date: '2025-03-04', end_date: '2025-03-06', destination: null, context: { parameters: ['accom_a'] }, travelers: null }],
        trip_items: [
          { id: 1, trip_id: 5, item_id: 'tent', display_name_override: null, count: 1, is_checked: 1, is_manual: 0, bag_distribution: null, notes: null, count_was_edited: 0, rule_snapshot: null },
          { id: 2, trip_id: 5, item_id: 'socks', display_name_override: null, count: 3, is_checked: 0, is_manual: 0, bag_distribution: null, notes: null, count_was_edited: 0, rule_snapshot: null }
        ],
        trip_kit_components: []
      }
    };
    const snapshot = decodeBackup(gzipSync(JSON.stringify(legacy)));
    const restored = await restoreSnapshot(s.pool, snapshot);
    expect(restored).toMatchObject({ people: 1, items: 2, trips: 1, trip_items: 2 });

    const list = await rows(5);
    expect(list.map((r) => [r.item_id, r.person_id, r.count])).toEqual([
      ['tent', null, 1],
      ['socks', 'owner', 3]
    ]);
    // The restored trip regenerates to the same list: nothing added or removed.
    const res = (await expectJson(
      await tripPatch(buildEvent(s.pool, { method: 'PATCH', params: { id: '5' }, body: { name: 'again' } }))
    )) as { diff: { added: unknown[]; to_be_removed: unknown[] } };
    expect(res.diff).toMatchObject({ added: [], to_be_removed: [] });
  });
});
