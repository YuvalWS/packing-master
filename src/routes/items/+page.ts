import type { PageLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const [{ items }, { parameters }] = await Promise.all([
    api.listItems(),
    api.listParameters()
  ]);
  return { items, parameters };
};
