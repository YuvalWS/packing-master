import type { PageLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch, params }) => {
  const api = makeApi(fetch);
  try {
    const { item } = await api.getItem(params.id);
    return { item };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'item_not_found' });
    }
    throw err;
  }
};
