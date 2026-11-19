import type { RequestHandler } from './$types.js';
import { ok, parseBody } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { defaultTravelers, requireTravelers, resolveTravelers } from '$lib/server/travelers.js';
import { ApiError, throwSvelteError } from '$lib/api/errors.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as parametersQ from '$lib/db/queries/parameters.js';
import * as tripItemsQ from '$lib/db/queries/trip-items.js';
import { generate } from '$lib/rules/generate.js';
import { TripCreateRequest } from '$lib/schemas/api/trip.js';

export const GET: RequestHandler = async ({ locals }) => {
  const trips = await tripsQ.listAll(locals.pool);
  return ok({ trips });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await parseBody(request, TripCreateRequest);
  const travelerIds = await withDomainErrors(async () =>
    body.travelers ? requireTravelers(locals.pool, body.travelers) : defaultTravelers(locals.pool)
  );
  const travelers = await resolveTravelers(locals.pool, travelerIds);

  const [items, parameters] = await Promise.all([
    itemsQ.listAll(locals.pool),
    parametersQ.listAll(locals.pool)
  ]);

  let generated;
  try {
    generated = generate({
      items,
      parameters,
      userParams: body.parameters,
      startISO: body.start_date,
      endISO: body.end_date,
      extraContext: body.extras,
      travelers
    });
  } catch (err) {
    throwSvelteError(
      new ApiError(400, 'generate_failed', err instanceof Error ? err.message : String(err))
    );
  }

  const tripId = await tripsQ.create(locals.pool, {
    name: body.name ?? null,
    template_id: body.template_id ?? null,
    start_date: body.start_date,
    end_date: body.end_date,
    destination: body.destination ?? null,
    context: { parameters: body.parameters, extras: body.extras },
    travelers: travelerIds
  });

  await tripItemsQ.insertGeneratedAll(locals.pool, tripId, generated.items);

  const trip = await tripsQ.getById(locals.pool, tripId);
  const tripItems = await tripItemsQ.listByTrip(locals.pool, tripId);
  return ok({ trip, items: tripItems, derived: generated.derived }, { status: 201 });
};
