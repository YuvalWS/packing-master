import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Condition } from '../../schemas/condition.js';
import type { QuantityFormula } from '../../schemas/quantity.js';
import type { GeneratedItem } from '../../rules/generate.js';
import type { MergeDiff } from '../../rules/merge.js';

export interface DbTripItemRow {
  id: number;
  trip_id: number;
  item_id: string | null;
  /** '' for a shared row; else the person the row is for (DESIGN.md 13). */
  person_id: string;
  display_name_override: string | null;
  count: number;
  is_checked: boolean;
  is_manual: boolean;
  bag_distribution: Record<string, unknown> | null;
  notes: string | null;
  count_was_edited: boolean;
  rule_snapshot: { include_when: Condition; quantity: QuantityFormula } | null;
  created_at: Date;
}

/**
 * A row by numeric id, or by catalog item id (+ person). An item id without a person
 * matches only when the item has a single row on the trip.
 */
export type TripItemKey = { itemId: string; personId?: string } | { rowId: number };

export class AmbiguousItemKey extends Error {
  constructor(readonly rowIds: number[]) {
    super('ambiguous_item_key');
  }
}

export interface TripItemPatch {
  count?: number;
  is_checked?: boolean;
  bag_distribution?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface ManualCatalogInput {
  item_id: string;
  person_id?: string;
  count?: number;
  bag_distribution?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface ManualFreeTextInput {
  display_name: string;
  count?: number;
  bag_distribution?: Record<string, unknown> | null;
  notes?: string | null;
}

function mapRow(r: RowDataPacket): DbTripItemRow {
  return {
    id: Number(r.id),
    trip_id: Number(r.trip_id),
    item_id: (r.item_id as string | null) ?? null,
    person_id: (r.person_id as string | null) ?? '',
    display_name_override: (r.display_name_override as string | null) ?? null,
    count: Number(r.count),
    is_checked: Boolean(r.is_checked),
    is_manual: Boolean(r.is_manual),
    bag_distribution: (r.bag_distribution as Record<string, unknown> | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    count_was_edited: Boolean(r.count_was_edited),
    rule_snapshot: (r.rule_snapshot as DbTripItemRow['rule_snapshot']) ?? null,
    created_at: r.created_at as Date
  };
}

const SELECT_COLS = `id, trip_id, item_id, person_id, display_name_override, count, is_checked, is_manual,
                     bag_distribution, notes, count_was_edited, rule_snapshot, created_at`;

export async function listByTrip(pool: Pool, tripId: number): Promise<DbTripItemRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM trip_items WHERE trip_id = ? ORDER BY id`,
    [tripId]
  );
  return rows.map(mapRow);
}

async function insertGenerated(
  conn: PoolConnection,
  tripId: number,
  g: GeneratedItem
): Promise<void> {
  await conn.execute(
    `INSERT INTO trip_items
       (trip_id, item_id, person_id, count, is_manual, rule_snapshot)
     VALUES (?, ?, ?, ?, FALSE, ?)`,
    [tripId, g.itemId, g.personId, g.count, JSON.stringify(g.ruleSnapshot)]
  );
}

async function updateFromMerge(
  conn: PoolConnection,
  tripId: number,
  u: MergeDiff['updated'][number]
): Promise<void> {
  if (u.countPreserved) {
    await conn.execute(
      `UPDATE trip_items SET rule_snapshot = ? WHERE trip_id = ? AND item_id = ? AND person_id = ?`,
      [JSON.stringify(u.newRuleSnapshot), tripId, u.itemId, u.personId]
    );
  } else {
    await conn.execute(
      `UPDATE trip_items SET count = ?, rule_snapshot = ? WHERE trip_id = ? AND item_id = ? AND person_id = ?`,
      [u.newCount, JSON.stringify(u.newRuleSnapshot), tripId, u.itemId, u.personId]
    );
  }
}

export async function insertGeneratedAll(
  pool: Pool,
  tripId: number,
  items: readonly GeneratedItem[]
): Promise<void> {
  if (items.length === 0) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const g of items) await insertGenerated(conn, tripId, g);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function applyDiff(
  pool: Pool,
  tripId: number,
  diff: MergeDiff
): Promise<void> {
  if (diff.added.length === 0 && diff.updated.length === 0) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const g of diff.added) await insertGenerated(conn, tripId, g);
    for (const u of diff.updated) await updateFromMerge(conn, tripId, u);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export interface RemoveItem {
  itemId?: string;
  /** With itemId: only that person's row. Without: every row of the item. */
  personId?: string;
  rowId?: number;
}

export interface RemoveResult {
  deleted: number;
  blockedManual: number;
}

export async function removeAutoItems(
  pool: Pool,
  tripId: number,
  keys: readonly RemoveItem[]
): Promise<RemoveResult> {
  let deleted = 0;
  let blockedManual = 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const key of keys) {
      let rows: RowDataPacket[] = [];
      if (key.rowId != null) {
        [rows] = await conn.query<RowDataPacket[]>(
          'SELECT id, is_manual FROM trip_items WHERE trip_id = ? AND id = ?',
          [tripId, key.rowId]
        );
      } else if (key.itemId) {
        [rows] =
          key.personId !== undefined
            ? await conn.query<RowDataPacket[]>(
                'SELECT id, is_manual FROM trip_items WHERE trip_id = ? AND item_id = ? AND person_id = ?',
                [tripId, key.itemId, key.personId]
              )
            : await conn.query<RowDataPacket[]>(
                'SELECT id, is_manual FROM trip_items WHERE trip_id = ? AND item_id = ?',
                [tripId, key.itemId]
              );
      }
      for (const row of rows) {
        if (row.is_manual) {
          blockedManual++;
          continue;
        }
        const [res] = await conn.execute<ResultSetHeader>('DELETE FROM trip_items WHERE id = ?', [row.id]);
        deleted += res.affectedRows;
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { deleted, blockedManual };
}

async function findByKey(
  conn: PoolConnection | Pool,
  tripId: number,
  key: TripItemKey
): Promise<DbTripItemRow | null> {
  let rows: RowDataPacket[];
  if ('rowId' in key) {
    [rows] = await conn.query<RowDataPacket[]>(
      `SELECT ${SELECT_COLS} FROM trip_items WHERE trip_id = ? AND id = ?`,
      [tripId, key.rowId]
    );
  } else if (key.personId !== undefined) {
    [rows] = await conn.query<RowDataPacket[]>(
      `SELECT ${SELECT_COLS} FROM trip_items WHERE trip_id = ? AND item_id = ? AND person_id = ?`,
      [tripId, key.itemId, key.personId]
    );
  } else {
    [rows] = await conn.query<RowDataPacket[]>(
      `SELECT ${SELECT_COLS} FROM trip_items WHERE trip_id = ? AND item_id = ? ORDER BY id`,
      [tripId, key.itemId]
    );
    if (rows.length > 1) throw new AmbiguousItemKey(rows.map((r) => Number(r.id)));
  }
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getByKey(
  pool: Pool,
  tripId: number,
  key: TripItemKey
): Promise<DbTripItemRow | null> {
  return findByKey(pool, tripId, key);
}

export async function updateOne(
  pool: Pool,
  tripId: number,
  key: TripItemKey,
  patch: TripItemPatch
): Promise<DbTripItemRow | null> {
  const row = await findByKey(pool, tripId, key);
  if (!row) return null;
  const sets: string[] = [];
  const args: (string | number | boolean | null)[] = [];
  if (patch.count !== undefined) {
    sets.push('count = ?');
    args.push(patch.count);
    sets.push('count_was_edited = TRUE');
  }
  if (patch.is_checked !== undefined) {
    sets.push('is_checked = ?');
    args.push(patch.is_checked);
  }
  if (patch.bag_distribution !== undefined) {
    sets.push('bag_distribution = ?');
    args.push(patch.bag_distribution ? JSON.stringify(patch.bag_distribution) : null);
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?');
    args.push(patch.notes);
  }
  if (sets.length > 0) {
    await pool.execute<ResultSetHeader>(
      `UPDATE trip_items SET ${sets.join(', ')} WHERE trip_id = ? AND id = ?`,
      [...args, tripId, row.id]
    );
  }
  return getByKey(pool, tripId, { rowId: row.id });
}

export async function insertManualCatalog(
  pool: Pool,
  tripId: number,
  input: ManualCatalogInput
): Promise<DbTripItemRow | null> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO trip_items
       (trip_id, item_id, person_id, count, is_manual, bag_distribution, notes)
     VALUES (?, ?, ?, ?, TRUE, ?, ?)`,
    [
      tripId,
      input.item_id,
      input.person_id ?? '',
      input.count ?? 1,
      input.bag_distribution ? JSON.stringify(input.bag_distribution) : null,
      input.notes ?? null
    ]
  );
  return getByKey(pool, tripId, { rowId: res.insertId });
}

export async function insertManualFreeText(
  pool: Pool,
  tripId: number,
  input: ManualFreeTextInput
): Promise<DbTripItemRow | null> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO trip_items
       (trip_id, item_id, display_name_override, count, is_manual, bag_distribution, notes)
     VALUES (?, NULL, ?, ?, TRUE, ?, ?)`,
    [
      tripId,
      input.display_name,
      input.count ?? 1,
      input.bag_distribution ? JSON.stringify(input.bag_distribution) : null,
      input.notes ?? null
    ]
  );
  return getByKey(pool, tripId, { rowId: res.insertId });
}

/**
 * Deletes any row, rule-generated or manual (DESIGN.md 14.2). A rule-generated item may
 * come back as a new row on a later settings change or catalog re-apply.
 */
export async function deleteRow(pool: Pool, tripId: number, key: TripItemKey): Promise<boolean> {
  const row = await getByKey(pool, tripId, key);
  if (!row) return false;
  await pool.execute<ResultSetHeader>('DELETE FROM trip_items WHERE id = ?', [row.id]);
  return true;
}

/** Keeps rule-generated rows the rules no longer want: they become manual (DESIGN.md 14.3). */
export async function adoptAutoItems(
  pool: Pool,
  tripId: number,
  keys: readonly RemoveItem[],
  markChecked: boolean
): Promise<number> {
  let adopted = 0;
  for (const key of keys) {
    const where =
      key.rowId != null
        ? { sql: 'id = ?', args: [key.rowId] }
        : key.personId !== undefined
          ? { sql: 'item_id = ? AND person_id = ?', args: [key.itemId!, key.personId] }
          : { sql: 'item_id = ?', args: [key.itemId!] };
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE trip_items SET is_manual = TRUE${markChecked ? ', is_checked = TRUE' : ''}
        WHERE trip_id = ? AND is_manual = FALSE AND ${where.sql}`,
      [tripId, ...where.args]
    );
    adopted += res.affectedRows;
  }
  return adopted;
}

/** Sets is_checked on the given rows of one trip; ids of other trips are ignored. */
export async function setChecked(
  pool: Pool,
  tripId: number,
  rowIds: readonly number[],
  isChecked: boolean
): Promise<number> {
  if (rowIds.length === 0) return 0;
  const [res] = await pool.query<ResultSetHeader>(
    'UPDATE trip_items SET is_checked = ? WHERE trip_id = ? AND id IN (?)',
    [isChecked, tripId, [...rowIds]]
  );
  return res.affectedRows;
}
