import type { Pool } from 'mysql2/promise';
import type { Catalog } from './load.js';

export async function seedCatalog(pool: Pool, catalog: Catalog): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE templates');
    await conn.query('TRUNCATE TABLE items');
    await conn.query('TRUNCATE TABLE parameters');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const p of catalog.parameters) {
      await conn.execute(
        'INSERT INTO parameters (id, display_name, category, is_singleton, is_derived, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, p.display_name, p.category, p.is_singleton, p.is_derived, p.sort_order]
      );
    }

    for (const i of catalog.items) {
      await conn.execute(
        `INSERT INTO items
          (id, display_name, category, default_bag, is_shared, is_optional, is_kit,
           kit_contents, include_when, quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          i.id,
          i.display_name,
          i.category ?? null,
          i.default_bag ?? null,
          i.is_shared,
          i.is_optional,
          i.is_kit,
          i.kit_contents ? JSON.stringify(i.kit_contents) : null,
          JSON.stringify(i.include_when),
          JSON.stringify(i.quantity),
          i.notes ?? null
        ]
      );
    }

    for (const t of catalog.templates) {
      await conn.execute(
        `INSERT INTO templates (id, display_name, default_parameters, default_extras, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          t.id,
          t.display_name,
          JSON.stringify(t.default_parameters),
          t.default_extras ? JSON.stringify(t.default_extras) : null,
          t.sort_order
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
