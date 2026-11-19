import { Umzug } from 'umzug';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

type Target = 'dev' | 'test';

interface ConnConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function connConfig(target: Target): ConnConfig {
  const prefix = target === 'test' ? 'DB_TEST_' : 'DB_';
  const get = (suffix: string): string => {
    const v = process.env[`${prefix}${suffix}`];
    if (!v) throw new Error(`missing env var ${prefix}${suffix}`);
    return v;
  };
  return {
    host: get('HOST'),
    port: Number(get('PORT')),
    user: get('USER'),
    password: get('PASS'),
    database: get('NAME')
  };
}

export interface MigrateOptions {
  /** Another database on the same server (tests of a migration against legacy data). */
  database?: string;
  /** Stop after this migration file, inclusive. */
  to?: string;
}

export async function runMigrations(target: Target, opts: MigrateOptions = {}): Promise<void> {
  const cfg = { ...connConfig(target), ...(opts.database ? { database: opts.database } : {}) };
  const connection = await mysql.createConnection({
    ...cfg,
    multipleStatements: true
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS umzug_meta (
      name        VARCHAR(255) NOT NULL PRIMARY KEY,
      executed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const migrationsDir = path.resolve(process.cwd(), 'migrations');

  const umzug = new Umzug({
    migrations: {
      glob: ['*.sql', { cwd: migrationsDir }],
      resolve: ({ name, path: file }) => ({
        name,
        up: async () => {
          if (!file) throw new Error(`missing path for migration ${name}`);
          const sql = await readFile(file, 'utf8');
          await connection.query(sql);
        }
      })
    },
    storage: {
      async executed() {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          'SELECT name FROM umzug_meta ORDER BY name'
        );
        return rows.map((r) => r.name as string);
      },
      async logMigration({ name }) {
        await connection.execute('INSERT INTO umzug_meta(name) VALUES (?)', [name]);
      },
      async unlogMigration({ name }) {
        await connection.execute('DELETE FROM umzug_meta WHERE name = ?', [name]);
      }
    },
    logger: console
  });

  await (opts.to ? umzug.up({ to: opts.to }) : umzug.up());
  await connection.end();
}

const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts');

if (isCli) {
  const target = process.argv[2];
  if (target !== 'dev' && target !== 'test') {
    console.error('usage: tsx src/lib/db/migrate.ts <dev|test>');
    process.exit(1);
  }
  runMigrations(target).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
