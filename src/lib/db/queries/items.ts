import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ItemSchema, type Item } from '../../schemas/item.js';

function mapRow(r: RowDataPacket): Item {
  const raw = {
    id: r.id,
    display_name: r.display_name,
    category: r.category ?? undefined,
    default_bag: r.default_bag ?? undefined,
    per: r.per,
    split: Boolean(r.split),
    person_id: r.person_id ?? undefined,
    is_optional: Boolean(r.is_optional),
    is_kit: Boolean(r.is_kit),
    kit_contents: r.kit_contents ?? undefined,
    include_when: r.include_when,
    quantity: r.quantity,
    notes: r.notes ?? undefined
  };
  return ItemSchema.parse(raw);
}

const SELECT_COLS = `id, display_name, category, default_bag, per, split, person_id, is_optional, is_kit,
                     kit_contents, include_when, quantity, notes`;

/** Active (non-archived) items: what trips are generated from. */
export async function listAll(pool: Pool): Promise<Item[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM items WHERE archived_at IS NULL ORDER BY category, id`
  );
  return rows.map(mapRow);
}

export type CatalogItem = Item & { archived: boolean };

export async function listCatalog(pool: Pool, includeArchived: boolean): Promise<CatalogItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS}, archived_at FROM items
      ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY category, id`
  );
  return rows.map((r) => ({ ...mapRow(r), archived: r.archived_at !== null }));
}

export async function getCatalogItem(pool: Pool, id: string): Promise<CatalogItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS}, archived_at FROM items WHERE id = ?`,
    [id]
  );
  const r = rows[0];
  return r ? { ...mapRow(r), archived: r.archived_at !== null } : null;
}

function columns(item: Item): (string | boolean | null)[] {
  return [
    item.display_name,
    item.category ?? null,
    item.default_bag ?? null,
    item.per,
    item.split,
    item.person_id ?? null,
    item.is_optional,
    item.is_kit,
    item.kit_contents ? JSON.stringify(item.kit_contents) : null,
    JSON.stringify(item.include_when),
    JSON.stringify(item.quantity),
    item.notes ?? null
  ];
}

export async function insert(pool: Pool, item: Item): Promise<void> {
  await pool.execute(
    `INSERT INTO items
       (id, display_name, category, default_bag, per, split, person_id, is_optional, is_kit,
        kit_contents, include_when, quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, ...columns(item)]
  );
}

export async function replace(pool: Pool, item: Item, archived: boolean): Promise<void> {
  await pool.execute(
    `UPDATE items SET display_name = ?, category = ?, default_bag = ?, per = ?, split = ?, person_id = ?,
       is_optional = ?, is_kit = ?, kit_contents = ?, include_when = ?, quantity = ?, notes = ?,
       archived_at = IF(?, COALESCE(archived_at, CURRENT_TIMESTAMP), NULL)
     WHERE id = ?`,
    [...columns(item), archived, item.id]
  );
}

/** Ids of trips that have a row for this catalog item. */
export async function tripsUsing(pool: Pool, id: string): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT trip_id FROM trip_items WHERE item_id = ? ORDER BY trip_id',
    [id]
  );
  return rows.map((r) => Number(r.trip_id));
}

export async function deleteById(pool: Pool, id: string): Promise<void> {
  await pool.execute('DELETE FROM items WHERE id = ?', [id]);
}

export async function getById(pool: Pool, id: string): Promise<Item | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM items WHERE id = ?`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function existsById(pool: Pool, id: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 AS n FROM items WHERE id = ?', [id]);
  return rows.length > 0;
}
