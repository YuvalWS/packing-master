import type { PageLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch, params }) => {
  const api = makeApi(fetch);
  try {
    const [{ template }, { parameters }] = await Promise.all([
      api.getTemplate(params.id),
      api.listParameters()
    ]);
    return { template, parameters };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'template_not_found' });
    }
    throw err;
  }
};
