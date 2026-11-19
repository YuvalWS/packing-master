import type { PageLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const [{ items }, { parameters }, { people }] = await Promise.all([
    api.listItems(),
    api.listParameters(),
    api.listPeople(true)
  ]);
  return { items, parameters, names: new Map(people.map((p) => [p.id, p.display_name])) };
};
