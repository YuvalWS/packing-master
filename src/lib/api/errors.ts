import { error as svelteError } from '@sveltejs/kit';
import { ZodError, type ZodIssue } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ErrorBody {
  error: string;
  message: string;
  details?: unknown;
  issues?: ZodIssue[];
}

export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: err.code, message: err.code, details: err.details }
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: 'invalid_request', message: 'invalid_request', issues: err.issues }
    };
  }
  return {
    status: 500,
    body: { error: 'internal_error', message: 'internal_error' }
  };
}

export function throwSvelteError(err: unknown): never {
  const { status, body } = toErrorBody(err);
  throw svelteError(status, body);
}
