import type { PageLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const { items } = await api.listItems();
  return { items };
};
