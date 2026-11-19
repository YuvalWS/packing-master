import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Parameter } from '../../schemas/parameter.js';

function mapRow(r: RowDataPacket): Parameter {
  return {
    id: r.id as string,
    display_name: r.display_name as string,
    category: r.category as Parameter['category'],
    is_singleton: Boolean(r.is_singleton),
    is_derived: Boolean(r.is_derived),
    sort_order: Number(r.sort_order)
  };
}

export async function listAll(pool: Pool): Promise<Parameter[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, display_name, category, is_singleton, is_derived, sort_order FROM parameters ORDER BY category, sort_order, id'
  );
  return rows.map(mapRow);
}

export async function getById(pool: Pool, id: string): Promise<Parameter | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, display_name, category, is_singleton, is_derived, sort_order FROM parameters WHERE id = ?',
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insert(pool: Pool, p: Parameter): Promise<void> {
  await pool.execute(
    'INSERT INTO parameters (id, display_name, category, is_singleton, is_derived, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [p.id, p.display_name, p.category, p.is_singleton, p.is_derived, p.sort_order]
  );
}

export async function replace(pool: Pool, p: Parameter): Promise<void> {
  await pool.execute(
    'UPDATE parameters SET display_name = ?, category = ?, is_singleton = ?, sort_order = ? WHERE id = ?',
    [p.display_name, p.category, p.is_singleton, p.sort_order, p.id]
  );
}

export async function deleteById(pool: Pool, id: string): Promise<void> {
  await pool.execute('DELETE FROM parameters WHERE id = ?', [id]);
}
