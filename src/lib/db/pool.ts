import mysql from 'mysql2/promise';
import process from 'node:process';

export type PoolTarget = 'dev' | 'test';

interface PoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function readConfig(target: PoolTarget): PoolConfig {
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

export function createPool(target: PoolTarget): mysql.Pool {
  return mysql.createPool({
    ...readConfig(target),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    namedPlaceholders: true
  });
}
