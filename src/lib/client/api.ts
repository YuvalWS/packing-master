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

export interface Api {
  listTrips(): Promise<{ trips: TripRowWithItemCount[] }>;
  getTrip(id: number): Promise<unknown>;
  createTrip(body: CreateTripBody): Promise<CreateTripResponse>;
  listParameters(): Promise<{ parameters: Parameter[] }>;
  listTemplates(): Promise<{ templates: Template[] }>;
  listItems(): Promise<{ items: Item[] }>;
}

export function makeApi(fetcher: Fetcher = fetch): Api {
  return {
    listTrips: () =>
      request<{ trips: TripRowWithItemCount[] }>(fetcher, 'GET', '/api/trips'),
    getTrip: (id) => request<unknown>(fetcher, 'GET', `/api/trips/${id}`),
    createTrip: (body) =>
      request<CreateTripResponse>(fetcher, 'POST', '/api/trips', body),
    listParameters: () =>
      request<{ parameters: Parameter[] }>(fetcher, 'GET', '/api/parameters'),
    listTemplates: () =>
      request<{ templates: Template[] }>(fetcher, 'GET', '/api/templates'),
    listItems: () => request<{ items: Item[] }>(fetcher, 'GET', '/api/items')
  };
}

export type { TripRow, TripRowWithItemCount, Parameter, Template, Item };
