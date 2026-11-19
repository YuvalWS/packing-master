import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface TripContext {
  parameters: string[];
  extras?: Record<string, unknown>;
}

export interface TripRow {
  id: number;
  name: string | null;
  template_id: string | null;
  start_date: string;
  end_date: string;
  destination: string | null;
  context: TripContext;
  /** Person ids coming on the trip; null for trips without people (DESIGN.md 13). */
  travelers: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface TripRowWithItemCount extends TripRow {
  item_count: number;
  checked_count: number;
}

export interface TripCreateInput {
  name?: string | null;
  template_id?: string | null;
  start_date: string;
  end_date: string;
  destination?: string | null;
  context: TripContext;
  travelers?: string[] | null;
}

export interface TripPatchInput {
  name?: string | null;
  template_id?: string | null;
  start_date?: string;
  end_date?: string;
  destination?: string | null;
  context?: TripContext;
  travelers?: string[] | null;
}

function toISODate(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v);
}

function mapRow(r: RowDataPacket): TripRow {
  return {
    id: Number(r.id),
    name: (r.name as string | null) ?? null,
    template_id: (r.template_id as string | null) ?? null,
    start_date: toISODate(r.start_date),
    end_date: toISODate(r.end_date),
    destination: (r.destination as string | null) ?? null,
    context: r.context as TripContext,
    travelers: Array.isArray(r.travelers) ? (r.travelers as string[]) : null,
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date
  };
}

const SELECT_COLS =
  'id, name, template_id, start_date, end_date, destination, context, travelers, created_at, updated_at';

export async function listAll(pool: Pool): Promise<TripRowWithItemCount[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS.split(', ').map((c) => `t.${c}`).join(', ')},
            COALESCE(c.item_count, 0) AS item_count,
            COALESCE(c.checked_count, 0) AS checked_count
     FROM trips t
     LEFT JOIN (
       SELECT trip_id,
              COUNT(*) AS item_count,
              SUM(is_checked) AS checked_count
       FROM trip_items GROUP BY trip_id
     ) c ON c.trip_id = t.id
     ORDER BY t.start_date DESC, t.id DESC`
  );
  return rows.map((r) => ({
    ...mapRow(r),
    item_count: Number(r.item_count),
    checked_count: Number(r.checked_count)
  }));
}

export async function getById(pool: Pool, id: number): Promise<TripRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLS} FROM trips WHERE id = ?`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(pool: Pool, input: TripCreateInput): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO trips (name, template_id, start_date, end_date, destination, context, travelers)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name ?? null,
      input.template_id ?? null,
      input.start_date,
      input.end_date,
      input.destination ?? null,
      JSON.stringify(input.context),
      input.travelers ? JSON.stringify(input.travelers) : null
    ]
  );
  return res.insertId;
}

export async function updateSettings(
  pool: Pool,
  id: number,
  patch: TripPatchInput
): Promise<boolean> {
  const sets: string[] = [];
  const args: (string | number | boolean | null)[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name);
  }
  if (patch.template_id !== undefined) {
    sets.push('template_id = ?');
    args.push(patch.template_id);
  }
  if (patch.start_date !== undefined) {
    sets.push('start_date = ?');
    args.push(patch.start_date);
  }
  if (patch.end_date !== undefined) {
    sets.push('end_date = ?');
    args.push(patch.end_date);
  }
  if (patch.destination !== undefined) {
    sets.push('destination = ?');
    args.push(patch.destination);
  }
  if (patch.context !== undefined) {
    sets.push('context = ?');
    args.push(JSON.stringify(patch.context));
  }
  if (patch.travelers !== undefined) {
    sets.push('travelers = ?');
    args.push(patch.travelers ? JSON.stringify(patch.travelers) : null);
  }
  if (sets.length === 0) return true;
  args.push(id);
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE trips SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
  return res.affectedRows > 0;
}

export async function deleteById(pool: Pool, id: number): Promise<boolean> {
  const [res] = await pool.execute<ResultSetHeader>('DELETE FROM trips WHERE id = ?', [id]);
  return res.affectedRows > 0;
}
