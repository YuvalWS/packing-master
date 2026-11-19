import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { mkdir, readdir, readFile, stat, unlink, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gunzipSync, gzipSync } from 'node:zlib';
import { z } from 'zod';
import { APP_VERSION } from './version.js';
import { isJsonColumn } from '../db/json-columns.js';

// Parents before children, so a restore inserts in FK order.
export const BACKUP_TABLES = [
  'parameters',
  'items',
  'templates',
  'trips',
  'trip_items',
  'trip_kit_components'
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_REASONS = ['manual', 'pre-update', 'pre-restore', 'daily', 'upload'] as const;
export type BackupReason = (typeof BACKUP_REASONS)[number];

const FORMAT = 'packing-master-backup';
const FORMAT_VERSION = 1;
const NAME_RE = /^packing-master-(\d{8}-\d{6})-([a-z-]+)(?:-\d+)?\.json\.gz$/;
// Automatic backups are pruned to this many per reason; manual and uploaded ones are kept.
const KEEP_AUTOMATIC = 14;

const Row = z.record(z.unknown());
export const Snapshot = z.object({
  format: z.literal(FORMAT),
  format_version: z.literal(FORMAT_VERSION),
  created_at: z.string(),
  app_version: z.string(),
  migrations: z.array(z.string()),
  tables: z.object(
    Object.fromEntries(BACKUP_TABLES.map((t) => [t, z.array(Row)])) as Record<
      BackupTable,
      z.ZodArray<typeof Row>
    >
  )
});
export type Snapshot = z.infer<typeof Snapshot>;

export interface BackupEntry {
  name: string;
  size: number;
  created_at: string;
  reason: string;
}

export class BackupError extends Error {
  constructor(
    readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

export function backupDir(): string {
  return process.env.BACKUP_DIR || path.resolve(process.cwd(), '.data/backups');
}

async function columnsOf(conn: Pool | PoolConnection, table: BackupTable) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows.map((r) => ({ name: String(r.name), isJson: isJsonColumn(table, String(r.name)) }));
}

async function appliedMigrations(conn: Pool | PoolConnection): Promise<string[]> {
  try {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT name FROM umzug_meta ORDER BY name');
    return rows.map((r) => String(r.name));
  } catch {
    return [];
  }
}

export async function exportSnapshot(pool: Pool): Promise<Snapshot> {
  const conn = await pool.getConnection();
  try {
    // One consistent read view across all tables.
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const tables = {} as Snapshot['tables'];
    for (const table of BACKUP_TABLES) {
      const [rows] = await conn.query<RowDataPacket[]>({
        sql: `SELECT * FROM ${conn.escapeId(table)} ORDER BY 1`,
        dateStrings: true
      });
      tables[table] = rows.map((r) => ({ ...r }));
    }
    const migrations = await appliedMigrations(conn);
    await conn.query('COMMIT');
    return {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      created_at: new Date().toISOString(),
      app_version: APP_VERSION,
      migrations,
      tables
    };
  } finally {
    conn.release();
  }
}

export function snapshotCounts(s: Snapshot): Record<BackupTable, number> {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, s.tables[t].length])) as Record<
    BackupTable,
    number
  >;
}

/** Replaces every row of every backed-up table with the snapshot's, in one transaction. */
export async function restoreSnapshot(pool: Pool, snapshot: Snapshot): Promise<Record<BackupTable, number>> {
  const known = new Set(await appliedMigrations(pool));
  const newer = snapshot.migrations.filter((m) => !known.has(m));
  if (newer.length > 0) {
    throw new BackupError('backup_from_newer_version', `unknown migrations: ${newer.join(', ')}`);
  }

  const conn = await pool.getConnection();
  try {
    const columns = new Map<BackupTable, { name: string; isJson: boolean }[]>();
    for (const table of BACKUP_TABLES) columns.set(table, await columnsOf(conn, table));

    for (const table of BACKUP_TABLES) {
      const allowed = new Set(columns.get(table)!.map((c) => c.name));
      for (const row of snapshot.tables[table]) {
        const unknown = Object.keys(row).filter((k) => !allowed.has(k));
        if (unknown.length > 0) {
          throw new BackupError('unknown_columns', `${table}: ${unknown.join(', ')}`);
        }
      }
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [...BACKUP_TABLES].reverse()) {
      await conn.query(`DELETE FROM ${conn.escapeId(table)}`);
    }
    for (const table of BACKUP_TABLES) {
      const cols = columns.get(table)!;
      for (const row of snapshot.tables[table]) {
        const present = cols.filter((c) => c.name in row);
        if (present.length === 0) continue;
        const values = present.map((c) => {
          const v = row[c.name];
          return c.isJson && v !== null && v !== undefined ? JSON.stringify(v) : v;
        });
        await conn.query(
          `INSERT INTO ${conn.escapeId(table)} (${present.map((c) => conn.escapeId(c.name)).join(', ')})
           VALUES (${present.map(() => '?').join(', ')})`,
          values
        );
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
  return snapshotCounts(snapshot);
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(
    d.getUTCMinutes()
  )}${p(d.getUTCSeconds())}`;
}

export function parseBackupName(name: string): { created_at: string; reason: string } | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const s = m[1]!;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
  return { created_at: iso, reason: m[2]! };
}

export function assertBackupName(name: string): void {
  if (!parseBackupName(name)) throw new BackupError('invalid_backup_name');
}

async function uniqueName(dir: string, reason: string): Promise<string> {
  const base = `packing-master-${stamp(new Date())}-${reason}`;
  const existing = new Set(await readdir(dir).catch(() => [] as string[]));
  if (!existing.has(`${base}.json.gz`)) return `${base}.json.gz`;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}.json.gz`;
    if (!existing.has(candidate)) return candidate;
  }
}

async function writeBackupFile(snapshot: Snapshot, reason: BackupReason): Promise<BackupEntry> {
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const name = await uniqueName(dir, reason);
  const data = gzipSync(Buffer.from(JSON.stringify(snapshot)));
  const tmp = path.join(dir, `.${name}.tmp`);
  await writeFile(tmp, data);
  await rename(tmp, path.join(dir, name));
  await pruneAutomatic(reason);
  return { name, size: data.length, ...parseBackupName(name)! };
}

export async function createBackup(pool: Pool, reason: BackupReason = 'manual'): Promise<BackupEntry> {
  return writeBackupFile(await exportSnapshot(pool), reason);
}

export async function listBackups(): Promise<BackupEntry[]> {
  const dir = backupDir();
  const names = await readdir(dir).catch(() => [] as string[]);
  const out: BackupEntry[] = [];
  for (const name of names) {
    const meta = parseBackupName(name);
    if (!meta) continue;
    const st = await stat(path.join(dir, name)).catch(() => null);
    if (st) out.push({ name, size: st.size, ...meta });
  }
  return out.sort((a, b) => (a.name < b.name ? 1 : -1));
}

async function pruneAutomatic(reason: BackupReason): Promise<void> {
  if (reason === 'manual' || reason === 'upload') return;
  const same = (await listBackups()).filter((b) => b.reason === reason);
  for (const old of same.slice(KEEP_AUTOMATIC)) {
    await unlink(path.join(backupDir(), old.name)).catch(() => undefined);
  }
}

export async function readBackupFile(name: string): Promise<Buffer> {
  assertBackupName(name);
  try {
    return await readFile(path.join(backupDir(), name));
  } catch {
    throw new BackupError('backup_not_found');
  }
}

export function decodeBackup(data: Buffer): Snapshot {
  let text: string;
  try {
    // gzip magic bytes; a plain .json upload is accepted too.
    text = data[0] === 0x1f && data[1] === 0x8b ? gunzipSync(data).toString('utf8') : data.toString('utf8');
  } catch {
    throw new BackupError('invalid_backup_file', 'not gzip or JSON');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_backup_file', 'not JSON');
  }
  const parsed = Snapshot.safeParse(raw);
  if (!parsed.success) throw new BackupError('invalid_backup_file', parsed.error.issues[0]?.message);
  return parsed.data;
}

export async function deleteBackup(name: string): Promise<void> {
  assertBackupName(name);
  try {
    await unlink(path.join(backupDir(), name));
  } catch {
    throw new BackupError('backup_not_found');
  }
}

/** Validates an uploaded file and stores it as a backup; restoring it is a separate step. */
export async function storeUploadedBackup(data: Buffer): Promise<BackupEntry> {
  return writeBackupFile(decodeBackup(data), 'upload');
}

/** Restores a stored backup, first saving the current data as a pre-restore backup. */
export async function restoreBackup(
  pool: Pool,
  name: string
): Promise<{ restored: Record<BackupTable, number>; safety_backup: BackupEntry }> {
  const snapshot = decodeBackup(await readBackupFile(name));
  const safety = await createBackup(pool, 'pre-restore');
  const restored = await restoreSnapshot(pool, snapshot);
  return { restored, safety_backup: safety };
}
