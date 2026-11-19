import type { Pool } from 'mysql2/promise';
import { ApiError } from '$lib/api/errors.js';
import type { Traveler } from '$lib/rules/evaluator.js';
import * as peopleQ from '$lib/db/queries/people.js';

/** Validates requested traveler ids: they must exist and not be archived. */
export async function requireTravelers(pool: Pool, ids: readonly string[]): Promise<string[]> {
  const people = new Map((await peopleQ.listAll(pool)).map((p) => [p.id, p]));
  const unknown = ids.filter((id) => !people.has(id));
  if (unknown.length > 0) throw new ApiError(400, 'unknown_person', { ids: unknown });
  return [...new Set(ids)];
}

/** A new trip without an explicit list takes everyone; null when no people exist yet. */
export async function defaultTravelers(pool: Pool): Promise<string[] | null> {
  const people = await peopleQ.listAll(pool);
  return people.length > 0 ? people.map((p) => p.id) : null;
}

/** The rules engine's view of a trip's travelers; undefined for a trip without people. */
export async function resolveTravelers(
  pool: Pool,
  ids: readonly string[] | null
): Promise<Traveler[] | undefined> {
  if (ids === null) return undefined;
  const people = new Map((await peopleQ.listAll(pool, true)).map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = people.get(id);
    return p ? [{ id: p.id, kind: p.kind }] : [];
  });
}
