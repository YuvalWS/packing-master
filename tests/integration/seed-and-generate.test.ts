import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createPool } from '../../src/lib/db/pool.js';
import { loadCatalog, type Catalog } from '../../src/lib/seed/load.js';
import { seedCatalog } from '../../src/lib/seed/seed.js';
import { runMigrations } from '../../src/lib/db/migrate.js';
import { generate } from '../../src/lib/rules/generate.js';
import { ConditionSchema } from '../../src/lib/schemas/condition.js';
import { QuantitySchema } from '../../src/lib/schemas/quantity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');

let pool: Pool;
let catalog: Catalog;

beforeAll(async () => {
  await runMigrations('test');
  pool = createPool('test');
  catalog = await loadCatalog(FIXTURES);
  await seedCatalog(pool, catalog);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('integration: seed db_test then generate from it', () => {
  it('row counts match the fixture YAML', async () => {
    const [params] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM parameters'
    );
    const [items] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM items');
    const [templates] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM templates'
    );
    expect(Number(params[0]?.n)).toBe(catalog.parameters.length);
    expect(Number(items[0]?.n)).toBe(catalog.items.length);
    expect(Number(templates[0]?.n)).toBe(catalog.templates.length);
  });

  it('JSON columns round-trip through MySQL with the original DSL shape', async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, include_when, quantity FROM items WHERE id = ?',
      ['item_complex_nested']
    );
    const row = rows[0]!;
    // mysql2 parses JSON columns automatically; should still validate.
    expect(ConditionSchema.safeParse(row.include_when).success).toBe(true);
    expect(QuantitySchema.safeParse(row.quantity).success).toBe(true);
  });

  it('generate() over the seeded catalog produces the expected items', async () => {
    // Reload catalog from DB so we know the end-to-end path works.
    const [params] = await pool.query<RowDataPacket[]>(
      'SELECT id, display_name, category, is_singleton, is_derived, sort_order FROM parameters'
    );
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT id, display_name, category, default_bag, per, split, person_id, is_optional,
              is_kit, kit_contents, include_when, quantity, notes
         FROM items`
    );

    const parameters = params.map((p) => ({
      id: p.id as string,
      display_name: p.display_name as string,
      category: p.category as 'accommodation' | 'environment' | 'day_plans' | 'derived' | 'misc',
      is_singleton: Boolean(p.is_singleton),
      is_derived: Boolean(p.is_derived),
      sort_order: Number(p.sort_order)
    }));
    const itemsParsed = items.map((i) => ({
      id: i.id as string,
      display_name: i.display_name as string,
      category: (i.category as string | null) ?? undefined,
      default_bag: (i.default_bag as string | null) ?? undefined,
      per: i.per,
      split: Boolean(i.split),
      person_id: (i.person_id as string | null) ?? undefined,
      is_optional: Boolean(i.is_optional),
      is_kit: Boolean(i.is_kit),
      kit_contents: i.kit_contents ?? undefined,
      include_when: i.include_when,
      quantity: i.quantity,
      notes: (i.notes as string | null) ?? undefined
    }));

    const r = generate({
      items: itemsParsed,
      parameters,
      userParams: ['accom_a', 'env_a', 'plan_a'],
      startISO: '2025-01-01', // Wed
      endISO: '2025-01-07' // Tue (1 Shabbat: Sat 4)
    });

    const ids = r.items.map((i) => i.itemId).sort();
    expect(ids).toEqual([
      'item_always',
      'item_complex_nested',
      'item_kit',
      'item_per_day',
      'item_per_shabbat',
      'item_per_two_days',
      'item_when_accom_a_and_plan_a',
      'item_when_env_a',
      'item_when_env_a_or_env_b',
      'item_when_not_plan_b'
    ]);

    const byId = new Map(r.items.map((i) => [i.itemId, i.count]));
    expect(byId.get('item_always')).toBe(1);
    expect(byId.get('item_per_day')).toBe(7);
    expect(byId.get('item_per_two_days')).toBe(4); // ceil(7/2)
    expect(byId.get('item_per_shabbat')).toBe(1);
    expect(byId.get('item_complex_nested')).toBe(8); // days+1, days=7
  });
});
