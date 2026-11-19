import type { PageLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch, params }) => {
  const api = makeApi(fetch);
  try {
    const [{ item }, { people }] = await Promise.all([api.getItem(params.id), api.listPeople(true)]);
    return { item, names: new Map(people.map((p) => [p.id, p.display_name])) };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'item_not_found' });
    }
    throw err;
  }
};
