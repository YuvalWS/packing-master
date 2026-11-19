import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Person, PersonKind } from '../../schemas/person.js';

export type PersonRow = Person & { archived: boolean };

function mapRow(r: RowDataPacket): PersonRow {
  return {
    id: r.id as string,
    display_name: r.display_name as string,
    kind: r.kind as PersonKind,
    sort_order: Number(r.sort_order),
    archived: r.archived_at !== null
  };
}

const COLS = 'id, display_name, kind, sort_order, archived_at';

export async function listAll(pool: Pool, includeArchived = false): Promise<PersonRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLS} FROM people ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY sort_order, id`
  );
  return rows.map(mapRow);
}

export async function getById(pool: Pool, id: string): Promise<PersonRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${COLS} FROM people WHERE id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insert(pool: Pool, p: Person): Promise<void> {
  await pool.execute('INSERT INTO people (id, display_name, kind, sort_order) VALUES (?, ?, ?, ?)', [
    p.id,
    p.display_name,
    p.kind,
    p.sort_order
  ]);
}

export async function replace(pool: Pool, p: Person, archived: boolean): Promise<void> {
  await pool.execute(
    `UPDATE people SET display_name = ?, kind = ?, sort_order = ?,
       archived_at = IF(?, COALESCE(archived_at, CURRENT_TIMESTAMP), NULL)
     WHERE id = ?`,
    [p.display_name, p.kind, p.sort_order, archived, p.id]
  );
}

export async function deleteById(pool: Pool, id: string): Promise<void> {
  await pool.execute('DELETE FROM people WHERE id = ?', [id]);
}
