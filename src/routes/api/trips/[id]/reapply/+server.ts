import type { RequestHandler } from './$types.js';
import { ok, parseIntId } from '$lib/api/json.js';
import { withDomainErrors } from '$lib/api/domain-errors.js';
import { applyRules } from '$lib/server/trip-rules.js';

// Re-runs the current catalog on a trip with its own settings (DESIGN.md 10.0).
export const POST: RequestHandler = async ({ locals, params }) => {
  const tripId = parseIntId(params.id);
  return ok(await withDomainErrors(() => applyRules(locals.pool, tripId, null)));
};
