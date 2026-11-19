import type { PageServerLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { makeApi, ClientApiError } from '$lib/client/api.js';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const api = makeApi(fetch);
  const parametersP = api.listParameters();
  const peopleP = api.listPeople(true);
  try {
    const trip = await api.getTrip(Number(params.id));
    const parameters = (await parametersP).parameters;
    const all = (await peopleP).people;
    // Archived people still show when this trip has them, so they can be toggled off.
    const people = all.filter((p) => !p.archived || (trip.trip.travelers ?? []).includes(p.id));
    return {
      trip: trip.trip,
      parameters,
      people
    };
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 404) {
      throw error(404, { error: 'trip_not_found' });
    }
    throw err;
  }
};
