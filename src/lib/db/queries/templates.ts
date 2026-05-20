import type { Pool, RowDataPacket } from 'mysql2/promise';
import { TemplateSchema, type Template } from '../../schemas/template.js';

function mapRow(r: RowDataPacket): Template {
  const raw = {
    id: r.id,
    display_name: r.display_name,
    default_parameters: r.default_parameters,
    default_extras: r.default_extras ?? undefined,
    sort_order: Number(r.sort_order)
  };
  return TemplateSchema.parse(raw);
}

const SELECT_COLS = 'id, display_name, default_parameters, default_extras, sort_order';

export async function listAll(pool: Pool): Promise<Template[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM templates ORDER BY sort_order, id`
  );
  return rows.map(mapRow);
}

export async function getById(pool: Pool, id: string): Promise<Template | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM templates WHERE id = ?`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
