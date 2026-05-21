import type { PageServerLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageServerLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const [tripsRes, parametersRes] = await Promise.all([
    api.listTrips(),
    api.listParameters()
  ]);
  return {
    trips: tripsRes.trips,
    parameters: parametersRes.parameters
  };
};
