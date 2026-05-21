import type { TripRow, TripRowWithItemCount } from '$lib/db/queries/trips.js';
import type { Parameter } from '$lib/schemas/parameter.js';
import type { Template } from '$lib/schemas/template.js';
import type { Item } from '$lib/schemas/item.js';

export interface ApiErrorPayload {
  error: string;
  message?: string;
  details?: unknown;
  issues?: unknown;
}

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? payload.error);
    this.status = status;
    this.code = payload.error;
    this.details = payload.details;
  }
}

type Fetcher = typeof fetch;

async function request<T>(
  fetcher: Fetcher,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetcher(path, init);
  if (!res.ok) {
    let payload: ApiErrorPayload;
    try {
      payload = (await res.json()) as ApiErrorPayload;
    } catch {
      payload = { error: 'unknown_error' };
    }
    throw new ClientApiError(res.status, payload);
  }
  return (await res.json()) as T;
}

export interface CreateTripBody {
  name?: string;
  template_id?: string;
  start_date: string;
  end_date: string;
  destination?: string;
  parameters: string[];
  extras?: Record<string, unknown>;
}

export interface CreateTripResponse {
  trip: TripRow;
  items: unknown[];
  derived: string[];
}

export interface KitComponentDefinition {
  id: string;
  display_name: string;
  default_count: number;
}

export interface EnrichedItem {
  row_id: number;
  item_id: string | null;
  display_name: string;
  category: string | null;
  default_bag: string | null;
  is_kit: boolean;
  is_optional: boolean;
  kit_contents: KitComponentDefinition[] | null;
  count: number;
  is_checked: boolean;
  is_manual: boolean;
  bag_distribution: Record<string, unknown> | null;
  notes: string | null;
  count_was_edited: boolean;
}

export interface KitComponentRow {
  trip_id: number;
  kit_item_id: string;
  component_id: string;
  is_checked: boolean;
}

export interface GetTripResponse {
  trip: TripRow;
  items: EnrichedItem[];
  kit_components: KitComponentRow[];
}

export interface PatchTripItemBody {
  count?: number;
  is_checked?: boolean;
  bag_distribution?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface PatchTripBody {
  name?: string | null;
  template_id?: string | null;
  start_date?: string;
  end_date?: string;
  destination?: string | null;
  parameters?: string[];
  extras?: Record<string, unknown>;
}

export interface PatchTripDiffAdded {
  itemId: string;
  count: number;
}

export interface PatchTripDiffUpdated {
  itemId: string;
  newCount: number;
  countPreserved: boolean;
}

export interface PatchTripDiffRemoved {
  row_id: number | null;
  item_id: string;
  display_name: string;
  count: number;
}

export interface PatchTripResponse {
  trip: TripRow;
  diff: {
    added: PatchTripDiffAdded[];
    updated: PatchTripDiffUpdated[];
    to_be_removed: PatchTripDiffRemoved[];
  };
}

export interface RegenerateBody {
  remove_item_keys: ({ item_id: string } | { row_id: number })[];
}

export interface DbTripItemRow {
  id: number;
  trip_id: number;
  item_id: string | null;
  display_name_override: string | null;
  count: number;
  is_checked: boolean;
  is_manual: boolean;
  bag_distribution: Record<string, unknown> | null;
  notes: string | null;
  count_was_edited: boolean;
}

export interface Api {
  listTrips(): Promise<{ trips: TripRowWithItemCount[] }>;
  getTrip(id: number): Promise<GetTripResponse>;
  createTrip(body: CreateTripBody): Promise<CreateTripResponse>;
  patchTrip(id: number, body: PatchTripBody): Promise<PatchTripResponse>;
  deleteTrip(id: number): Promise<{ deleted: true }>;
  regenerateTrip(id: number, body: RegenerateBody): Promise<{ deleted: number }>;
  patchTripItem(
    tripId: number,
    key: string | number,
    body: PatchTripItemBody
  ): Promise<{ item: DbTripItemRow }>;
  toggleKitComponent(
    tripId: number,
    itemId: string,
    componentId: string
  ): Promise<{ component: KitComponentRow }>;
  listParameters(): Promise<{ parameters: Parameter[] }>;
  listTemplates(): Promise<{ templates: Template[] }>;
  listItems(): Promise<{ items: Item[] }>;
}

export function makeApi(fetcher: Fetcher = fetch): Api {
  return {
    listTrips: () =>
      request<{ trips: TripRowWithItemCount[] }>(fetcher, 'GET', '/api/trips'),
    getTrip: (id) => request<GetTripResponse>(fetcher, 'GET', `/api/trips/${id}`),
    createTrip: (body) =>
      request<CreateTripResponse>(fetcher, 'POST', '/api/trips', body),
    patchTrip: (id, body) =>
      request<PatchTripResponse>(fetcher, 'PATCH', `/api/trips/${id}`, body),
    deleteTrip: (id) =>
      request<{ deleted: true }>(fetcher, 'DELETE', `/api/trips/${id}`),
    regenerateTrip: (id, body) =>
      request<{ deleted: number }>(fetcher, 'POST', `/api/trips/${id}/regenerate`, body),
    patchTripItem: (tripId, key, body) =>
      request<{ item: DbTripItemRow }>(
        fetcher,
        'PATCH',
        `/api/trips/${tripId}/items/${encodeURIComponent(String(key))}`,
        body
      ),
    toggleKitComponent: (tripId, itemId, componentId) =>
      request<{ component: KitComponentRow }>(
        fetcher,
        'POST',
        `/api/trips/${tripId}/items/${encodeURIComponent(itemId)}/components/${encodeURIComponent(componentId)}`
      ),
    listParameters: () =>
      request<{ parameters: Parameter[] }>(fetcher, 'GET', '/api/parameters'),
    listTemplates: () =>
      request<{ templates: Template[] }>(fetcher, 'GET', '/api/templates'),
    listItems: () => request<{ items: Item[] }>(fetcher, 'GET', '/api/items')
  };
}

export type { TripRow, TripRowWithItemCount, Parameter, Template, Item };
