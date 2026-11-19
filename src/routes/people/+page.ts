import type { PageLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch }) => {
  const { people } = await makeApi(fetch).listPeople();
  return { people };
};
