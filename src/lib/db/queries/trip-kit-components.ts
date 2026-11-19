import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface TripKitComponentRow {
  id: number;
  trip_id: number;
  kit_item_id: string;
  /** '' for a shared kit row; else the person whose kit it is. */
  person_id: string;
  component_id: string;
  is_checked: boolean;
}

function mapRow(r: RowDataPacket): TripKitComponentRow {
  return {
    id: Number(r.id),
    trip_id: Number(r.trip_id),
    kit_item_id: r.kit_item_id as string,
    person_id: (r.person_id as string) ?? '',
    component_id: r.component_id as string,
    is_checked: Boolean(r.is_checked)
  };
}

export async function listByTrip(pool: Pool, tripId: number): Promise<TripKitComponentRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, trip_id, kit_item_id, person_id, component_id, is_checked FROM trip_kit_components WHERE trip_id = ? ORDER BY kit_item_id, person_id, component_id',
    [tripId]
  );
  return rows.map(mapRow);
}

export async function setChecked(
  pool: Pool,
  tripId: number,
  kitItemId: string,
  personId: string,
  componentId: string,
  isChecked: boolean
): Promise<TripKitComponentRow> {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO trip_kit_components (trip_id, kit_item_id, person_id, component_id, is_checked)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_checked = VALUES(is_checked)`,
    [tripId, kitItemId, personId, componentId, isChecked]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, trip_id, kit_item_id, person_id, component_id, is_checked FROM trip_kit_components WHERE trip_id = ? AND kit_item_id = ? AND person_id = ? AND component_id = ?',
    [tripId, kitItemId, personId, componentId]
  );
  return mapRow(rows[0]!);
}

export async function toggleCheck(
  pool: Pool,
  tripId: number,
  kitItemId: string,
  personId: string,
  componentId: string
): Promise<TripKitComponentRow> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT is_checked FROM trip_kit_components WHERE trip_id = ? AND kit_item_id = ? AND person_id = ? AND component_id = ?',
    [tripId, kitItemId, personId, componentId]
  );
  const current = rows[0] ? Boolean(rows[0].is_checked) : false;
  return setChecked(pool, tripId, kitItemId, personId, componentId, !current);
}
