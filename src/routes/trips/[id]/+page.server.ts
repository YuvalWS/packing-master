import type { PageServerLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';
import { derive } from '$lib/rules/derived.js';

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
      parameters,
      derived: derive(trip.trip.start_date, trip.trip.end_date)
    };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'trip_not_found' });
    }
    throw err;
  }
};
