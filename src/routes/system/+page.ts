import type { PageLoad } from './$types.js';
import { makeSystemApi } from '$lib/client/system-api.js';

export const load: PageLoad = async ({ fetch }) => {
  const api = makeSystemApi(fetch);
  const [system, backups] = await Promise.all([api.system(), api.listBackups()]);
  return { system, backups: backups.backups };
};
