import type { Parameter } from '$lib/schemas/parameter.js';
import strings from '$lib/strings.js';

interface TripLike {
  name: string | null;
  start_date: string;
  end_date: string;
  context: { parameters: string[] };
}

export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function tripDisplayName(
  trip: TripLike,
  parametersById: Map<string, Parameter>
): string {
  if (trip.name && trip.name.trim().length > 0) return trip.name;

  const days = daysBetween(trip.start_date, trip.end_date);
  const accommodation = trip.context.parameters
    .map((id) => parametersById.get(id))
    .find((p) => p !== undefined && p.category === 'accommodation');

  if (!accommodation) {
    return strings.trips_list.no_name_fallback_no_accommodation.replace('{days}', String(days));
  }
  return strings.trips_list.no_name_fallback
    .replace('{days}', String(days))
    .replace('{accommodation}', accommodation.display_name);
}
