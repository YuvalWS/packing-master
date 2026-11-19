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
  travelers?: string[];
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
  person_id?: string | null;
  person_name?: string | null;
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
  person_id: string;
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
  travelers?: string[];
  extras?: Record<string, unknown>;
}

export interface PersonRef {
  person_id?: string | null;
  person_name?: string | null;
}

export interface Person {
  id: string;
  display_name: string;
  kind: 'adult' | 'kid' | 'baby';
  sort_order: number;
  archived: boolean;
}

export interface PatchTripDiffAdded extends PersonRef {
  item_id: string;
  display_name: string;
  count: number;
}

export interface PatchTripDiffUpdated extends PersonRef {
  item_id: string;
  display_name: string;
  previous_count: number;
  new_count: number;
  count_preserved: boolean;
}

export interface PatchTripDiffRemoved extends PersonRef {
  row_id: number | null;
  item_id: string;
  display_name: string;
  count: number;
  is_checked: boolean;
}

export interface PatchTripResponse {
  trip: TripRow;
  diff: {
    added: PatchTripDiffAdded[];
    updated: PatchTripDiffUpdated[];
    to_be_removed: PatchTripDiffRemoved[];
  };
}

type RowKey = { item_id: string; person_id?: string } | { row_id: number };

export interface RegenerateBody {
  remove_item_keys: RowKey[];
  keep_item_keys?: RowKey[];
  pack_item_keys?: RowKey[];
}

export interface AddCatalogItemBody {
  item_id: string;
  count?: number;
  bag_distribution?: Record<string, unknown>;
  notes?: string;
}

export interface AddFreeTextItemBody {
  display_name: string;
  count?: number;
  bag_distribution?: Record<string, unknown>;
  notes?: string;
  category?: string;
  default_bag?: string;
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
  regenerateTrip(id: number, body: RegenerateBody): Promise<{ deleted: number; kept: number; packed: number }>;
  patchTripItem(
    tripId: number,
    key: string | number,
    body: PatchTripItemBody
  ): Promise<{ item: DbTripItemRow }>;
  deleteTripItem(tripId: number, key: string | number): Promise<{ deleted: true }>;
  toggleKitComponent(
    tripId: number,
    itemId: string,
    componentId: string
  ): Promise<{ component: KitComponentRow }>;
  addCatalogItem(tripId: number, body: AddCatalogItemBody): Promise<{ item: DbTripItemRow }>;
  addFreeTextItem(tripId: number, body: AddFreeTextItemBody): Promise<{ item: DbTripItemRow }>;
  listParameters(): Promise<{ parameters: Parameter[] }>;
  listPeople(includeArchived?: boolean): Promise<{ people: Person[] }>;
  createPerson(body: { id: string; display_name: string; kind: Person['kind']; sort_order?: number }): Promise<{ person: Person }>;
  patchPerson(
    id: string,
    body: Partial<Pick<Person, 'display_name' | 'kind' | 'sort_order' | 'archived'>>
  ): Promise<{ person: Person }>;
  deletePerson(id: string): Promise<{ deleted?: true; archived?: true }>;
  listTemplates(): Promise<{ templates: Template[] }>;
  listItems(): Promise<{ items: Item[] }>;
  getItem(id: string): Promise<{ item: Item }>;
  getTemplate(id: string): Promise<{ template: Template }>;
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
      request<{ deleted: number; kept: number; packed: number }>(fetcher, 'POST', `/api/trips/${id}/regenerate`, body),
    patchTripItem: (tripId, key, body) =>
      request<{ item: DbTripItemRow }>(
        fetcher,
        'PATCH',
        `/api/trips/${tripId}/items/${encodeURIComponent(String(key))}`,
        body
      ),
    deleteTripItem: (tripId, key) =>
      request<{ deleted: true }>(
        fetcher,
        'DELETE',
        `/api/trips/${tripId}/items/${encodeURIComponent(String(key))}`
      ),
    toggleKitComponent: (tripId, itemId, componentId) =>
      request<{ component: KitComponentRow }>(
        fetcher,
        'POST',
        `/api/trips/${tripId}/items/${encodeURIComponent(itemId)}/components/${encodeURIComponent(componentId)}`
      ),
    addCatalogItem: (tripId, body) =>
      request<{ item: DbTripItemRow }>(fetcher, 'POST', `/api/trips/${tripId}/items`, body),
    addFreeTextItem: (tripId, body) =>
      request<{ item: DbTripItemRow }>(fetcher, 'POST', `/api/trips/${tripId}/items`, body),
    listParameters: () =>
      request<{ parameters: Parameter[] }>(fetcher, 'GET', '/api/parameters'),
    listPeople: (includeArchived = false) =>
      request<{ people: Person[] }>(
        fetcher,
        'GET',
        `/api/people${includeArchived ? '?include_archived=1' : ''}`
      ),
    createPerson: (body) => request<{ person: Person }>(fetcher, 'POST', '/api/people', body),
    patchPerson: (id, body) =>
      request<{ person: Person }>(fetcher, 'PATCH', `/api/people/${encodeURIComponent(id)}`, body),
    deletePerson: (id) =>
      request<{ deleted?: true; archived?: true }>(fetcher, 'DELETE', `/api/people/${encodeURIComponent(id)}`),
    listTemplates: () =>
      request<{ templates: Template[] }>(fetcher, 'GET', '/api/templates'),
    listItems: () => request<{ items: Item[] }>(fetcher, 'GET', '/api/items'),
    getItem: (id: string) => request<{ item: Item }>(fetcher, 'GET', `/api/items/${encodeURIComponent(id)}`),
    getTemplate: (id: string) =>
      request<{ template: Template }>(fetcher, 'GET', `/api/templates/${encodeURIComponent(id)}`)
  };
}

export type { TripRow, TripRowWithItemCount, Parameter, Template, Item };

/** What to do with items a settings change left behind (DESIGN.md 14.3). */
export type OrphanChoice = 'remove' | 'keep' | 'pack';
export interface OrphanDecisions {
  remove: PatchTripDiffRemoved[];
  keep: PatchTripDiffRemoved[];
  pack: PatchTripDiffRemoved[];
}
