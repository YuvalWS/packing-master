import { json } from '@sveltejs/kit';
import type { ZodSchema } from 'zod';
import { ApiError, throwSvelteError } from './errors.js';

export function ok<T>(data: T, init?: ResponseInit): Response {
  return json(data as unknown as Parameters<typeof json>[0], init);
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throwSvelteError(new ApiError(400, 'invalid_json'));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throwSvelteError(parsed.error);
  return parsed.data;
}

export function parseRouteParam<T>(
  value: string | undefined,
  schema: ZodSchema<T>,
  code = 'invalid_route_param'
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throwSvelteError(new ApiError(400, code, parsed.error.issues));
  return parsed.data;
}

export function parseIntId(value: string | undefined, code = 'invalid_id'): number {
  if (!value || !/^\d+$/.test(value)) {
    throwSvelteError(new ApiError(400, code));
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throwSvelteError(new ApiError(400, code));
  }
  return n;
}
