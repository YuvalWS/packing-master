import process from 'node:process';
import { createPool, type PoolTarget } from '../db/pool.js';
import { backupDir, createBackup } from './backup.js';

// Writes a backup of the dev (or test) database into BACKUP_DIR (default ./.data/backups),
// e.g. to carry the local catalog to a fresh install via Settings → upload → restore.
async function main() {
  const target = (process.argv[2] ?? 'dev') as PoolTarget;
  if (target !== 'dev' && target !== 'test') {
    console.error('usage: tsx src/lib/server/backup-cli.ts <dev|test>');
    process.exit(1);
  }
  const pool = createPool(target);
  try {
    const b = await createBackup(pool, 'manual');
    console.log(`wrote ${backupDir()}/${b.name} (${b.size} bytes)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
