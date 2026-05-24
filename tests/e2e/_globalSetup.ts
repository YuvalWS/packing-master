import { setupTestDb } from './_helpers.js';

export default async function globalSetup(): Promise<void> {
  await setupTestDb();
}
