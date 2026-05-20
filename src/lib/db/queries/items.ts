import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ItemSchema, type Item } from '../../schemas/item.js';

function mapRow(r: RowDataPacket): Item {
  const raw = {
    id: r.id,
    display_name: r.display_name,
    category: r.category ?? undefined,
    default_bag: r.default_bag ?? undefined,
    is_shared: Boolean(r.is_shared),
    is_optional: Boolean(r.is_optional),
    is_kit: Boolean(r.is_kit),
    kit_contents: r.kit_contents ?? undefined,
    include_when: r.include_when,
    quantity: r.quantity,
    notes: r.notes ?? undefined
  };
  return ItemSchema.parse(raw);
}

const SELECT_COLS = `id, display_name, category, default_bag, is_shared, is_optional, is_kit,
                     kit_contents, include_when, quantity, notes`;

export async function listAll(pool: Pool): Promise<Item[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM items ORDER BY category, id`
  );
  return rows.map(mapRow);
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
