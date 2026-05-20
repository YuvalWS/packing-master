import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseBody, parseIntId, parseRouteParam } from '../../../src/lib/api/json.js';
import { ApiError, toErrorBody } from '../../../src/lib/api/errors.js';

function makeJsonRequest(body: unknown): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function makeBadJsonRequest(): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json'
  });
}

describe('parseBody', () => {
  it('returns parsed body when valid', async () => {
    const schema = z.object({ x: z.number() });
    const result = await parseBody(makeJsonRequest({ x: 7 }), schema);
    expect(result).toEqual({ x: 7 });
  });

  it('throws on invalid JSON', async () => {
    const schema = z.object({ x: z.number() });
    await expect(parseBody(makeBadJsonRequest(), schema)).rejects.toThrow();
  });

  it('throws on Zod failure', async () => {
    const schema = z.object({ x: z.number() });
    await expect(parseBody(makeJsonRequest({ x: 'no' }), schema)).rejects.toThrow();
  });
});

describe('parseRouteParam', () => {
  it('returns the parsed value when valid', () => {
    expect(parseRouteParam('abc', z.string().min(1))).toBe('abc');
  });
  it('throws on missing value', () => {
    expect(() => parseRouteParam(undefined, z.string().min(1))).toThrow();
  });
});

describe('parseIntId', () => {
  it('parses a positive integer string', () => {
    expect(parseIntId('42')).toBe(42);
  });
  it('rejects non-numeric', () => {
    expect(() => parseIntId('abc')).toThrow();
  });
  it('rejects zero', () => {
    expect(() => parseIntId('0')).toThrow();
  });
  it('rejects negative', () => {
    expect(() => parseIntId('-1')).toThrow();
  });
});

describe('toErrorBody', () => {
  it('maps ApiError to its status + code', () => {
    const { status, body } = toErrorBody(new ApiError(404, 'not_found'));
    expect(status).toBe(404);
    expect(body.error).toBe('not_found');
  });
  it('maps ZodError to 400 invalid_request with issues', () => {
    const parsed = z.object({ x: z.number() }).safeParse({ x: 'no' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const { status, body } = toErrorBody(parsed.error);
    expect(status).toBe(400);
    expect(body.error).toBe('invalid_request');
    expect(body.issues).toBeDefined();
  });
  it('falls back to 500 internal_error', () => {
    const { status, body } = toErrorBody(new Error('boom'));
    expect(status).toBe(500);
    expect(body.error).toBe('internal_error');
  });
});
