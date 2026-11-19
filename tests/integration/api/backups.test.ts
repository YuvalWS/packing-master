import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  setupSeededPool,
  teardownSeededPool,
  resetTripData,
  type SeededPool
} from '../../helpers/seeded-pool.js';
import { buildEvent, expectJson } from '../../helpers/request-event.js';
import { POST as tripsCreate } from '../../../src/routes/api/trips/+server.js';
import { GET as tripGet } from '../../../src/routes/api/trips/[id]/+server.js';
import { PATCH as itemPatch } from '../../../src/routes/api/trips/[id]/items/[key]/+server.js';
import { POST as itemsAdd } from '../../../src/routes/api/trips/[id]/items/+server.js';
import { GET as backupsList, POST as backupsCreate } from '../../../src/routes/api/backups/+server.js';
import {
  GET as backupDownload,
  DELETE as backupDelete
} from '../../../src/routes/api/backups/[name]/+server.js';
import { POST as backupRestore } from '../../../src/routes/api/backups/[name]/restore/+server.js';
import { POST as backupUpload } from '../../../src/routes/api/backups/upload/+server.js';
import { exportSnapshot } from '../../../src/lib/server/backup.js';

let s: SeededPool;
let dir: string;

beforeAll(async () => {
  s = await setupSeededPool();
});
afterAll(async () => {
  await teardownSeededPool(s);
});
beforeEach(async () => {
  await resetTripData(s.pool);
  dir = await mkdtemp(path.join(os.tmpdir(), 'pm-backups-'));
  process.env.BACKUP_DIR = dir;
  return async () => {
    delete process.env.BACKUP_DIR;
    await rm(dir, { recursive: true, force: true });
  };
});

interface TripBody {
  trip: { id: number; start_date: string };
  items: { row_id: number; item_id: string | null; is_checked: boolean; display_name: string; count: number }[];
}

async function makeTrip(): Promise<number> {
  const res = await tripsCreate(
    buildEvent(s.pool, {
      method: 'POST',
      body: {
        name: 'Backup trip',
        start_date: '2025-03-06',
        end_date: '2025-03-09',
        parameters: ['accom_a', 'env_a', 'plan_a']
      }
    })
  );
  return ((await expectJson(res)) as { trip: { id: number } }).trip.id;
}

async function getTrip(id: number): Promise<TripBody> {
  return (await expectJson(await tripGet(buildEvent(s.pool, { params: { id: String(id) } })))) as TripBody;
}

async function createBackup(): Promise<string> {
  const res = await backupsCreate(buildEvent(s.pool, { method: 'POST', body: { reason: 'manual' } }));
  expect(res.status).toBe(201);
  return ((await expectJson(res)) as { backup: { name: string } }).backup.name;
}

describe('backups', () => {
  it('round-trips trips, edits and manual items through backup and restore', async () => {
    const id = await makeTrip();
    const before = await getTrip(id);
    const first = before.items.find((i) => i.item_id)!;
    await itemPatch(
      buildEvent(s.pool, {
        method: 'PATCH',
        params: { id: String(id), key: first.item_id! },
        body: { is_checked: true, count: 9, notes: 'packed' }
      })
    );
    await itemsAdd(
      buildEvent(s.pool, {
        method: 'POST',
        params: { id: String(id) },
        body: { display_name: 'free text thing', count: 2 }
      })
    );
    const edited = await getTrip(id);
    const name = await createBackup();

    await resetTripData(s.pool);
    await expect(tripGet(buildEvent(s.pool, { params: { id: String(id) } }))).rejects.toMatchObject({
      status: 404
    });

    const res = await backupRestore(buildEvent(s.pool, { method: 'POST', params: { name } }));
    const body = (await expectJson(res)) as {
      restored: Record<string, number>;
      safety_backup: { reason: string };
    };
    expect(body.restored.trips).toBe(1);
    expect(body.safety_backup.reason).toBe('pre-restore');

    const after = await getTrip(id);
    expect(after.trip.start_date).toBe(edited.trip.start_date);
    expect(after.items).toEqual(edited.items);
  });

  it('keeps JSON columns intact (conditions, quantities, contexts)', async () => {
    await makeTrip();
    const snap = await exportSnapshot(s.pool);
    const name = await createBackup();
    await backupRestore(buildEvent(s.pool, { method: 'POST', params: { name } }));
    const again = await exportSnapshot(s.pool);
    const strip = (x: typeof snap) => ({ ...x, created_at: '' });
    expect(strip(again)).toEqual(strip(snap));
    expect(typeof snap.tables.items[0]!.quantity).toBe('object');
  });

  it('lists, downloads, uploads and deletes backups', async () => {
    const name = await createBackup();
    const list = (await expectJson(await backupsList(buildEvent(s.pool)))) as {
      backups: { name: string; reason: string }[];
    };
    expect(list.backups.map((b) => b.name)).toEqual([name]);

    const dl = await backupDownload(buildEvent(s.pool, { params: { name } }));
    expect(dl.headers.get('content-type')).toBe('application/gzip');
    const bytes = new Uint8Array(await dl.arrayBuffer());

    const up = await backupUpload({
      ...buildEvent(s.pool, { method: 'POST' }),
      request: new Request('http://localhost/api/backups/upload', { method: 'POST', body: bytes })
    });
    expect(up.status).toBe(201);
    const uploaded = ((await expectJson(up)) as { backup: { name: string; reason: string } }).backup;
    expect(uploaded.reason).toBe('upload');

    await backupDelete(buildEvent(s.pool, { method: 'DELETE', params: { name } }));
    const after = (await expectJson(await backupsList(buildEvent(s.pool)))) as {
      backups: { name: string }[];
    };
    expect(after.backups.map((b) => b.name)).toEqual([uploaded.name]);
  });

  it('makes a manual backup from a bare POST', async () => {
    const res = await backupsCreate({
      ...buildEvent(s.pool, { method: 'POST' }),
      request: new Request('http://localhost/api/backups', { method: 'POST' })
    });
    expect(res.status).toBe(201);
    expect(((await expectJson(res)) as { backup: { reason: string } }).backup.reason).toBe('manual');
  });

  it('rejects path traversal and garbage uploads', async () => {
    await expect(
      backupDownload(buildEvent(s.pool, { params: { name: '../../etc/passwd' } }))
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      backupUpload({
        ...buildEvent(s.pool, { method: 'POST' }),
        request: new Request('http://localhost/x', { method: 'POST', body: gzipSync('{"nope":1}') })
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a backup made by a newer schema', async () => {
    const snap = await exportSnapshot(s.pool);
    snap.migrations.push('9999_from_the_future.sql');
    const name = 'packing-master-20990101-000000-upload.json.gz';
    await writeFile(path.join(dir, name), gzipSync(JSON.stringify(snap)));
    await expect(
      backupRestore(buildEvent(s.pool, { method: 'POST', params: { name } }))
    ).rejects.toMatchObject({ status: 409 });
  });
});
