import type { PageServerLoad } from './$types.js';
import { makeApi } from '$lib/client/api.js';

export const load: PageServerLoad = async ({ fetch }) => {
  const api = makeApi(fetch);
  const [templates, parameters] = await Promise.all([
    api.listTemplates(),
    api.listParameters()
  ]);
  return {
    templates: templates.templates,
    parameters: parameters.parameters
  };
};
