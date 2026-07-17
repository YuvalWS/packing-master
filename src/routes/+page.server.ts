import type { PageServerLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageServerLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const [tripsRes, parametersRes] = await Promise.all([
    api.listTrips(),
    api.listParameters()
  ]);
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    trips: tripsRes.trips,
    parameters: parametersRes.parameters,
    todayISO
  };
};
