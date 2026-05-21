import type { PageServerLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';

export const load: PageServerLoad = async ({ fetch, params, depends }) => {
  depends(`trip:${params.id}`);
  const api = makeApi(fetch);
  const parametersP = api.listParameters();
  try {
    const trip = await api.getTrip(Number(params.id));
    const parameters = (await parametersP).parameters;
    return {
      trip: trip.trip,
      items: trip.items,
      kitComponents: trip.kit_components,
      parameters
    };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'trip_not_found' });
    }
    throw err;
  }
};
