import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ENDPOINTS, apiIndex, llmsTxt, openApiDocument } from '../../src/lib/api/catalog.js';

const ROUTES = path.resolve(__dirname, '../../src/routes');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? routeFiles(full) : f === '+server.ts' ? [full] : [];
  });
}

function toApiPath(file: string): string {
  const rel = path.relative(ROUTES, path.dirname(file)).split(path.sep).join('/');
  return '/' + rel.replace(/\[(\w+)\]/g, '{$1}');
}

describe('API catalog', () => {
  it('documents every /api route handler', () => {
    const documented = new Set(ENDPOINTS.map((e) => e.path.replace(/\{\w+\}/g, '{}')));
    const routes = routeFiles(path.join(ROUTES, 'api'))
      .map(toApiPath)
      .filter((p) => p !== '/api' && p !== '/api/openapi.json')
      .map((p) => p.replace(/\{\w+\}/g, '{}'));
    const missing = routes.filter((r) => !documented.has(r));
    expect(missing).toEqual([]);
  });

  it('renders the index with JSON schemas for request bodies', () => {
    const index = apiIndex('1.2.3');
    const create = index.endpoints.find((e) => e.method === 'POST' && e.path === '/api/trips');
    expect(create?.body).toMatchObject({ type: 'object', required: expect.arrayContaining(['start_date']) });
  });

  it('renders a valid-looking OpenAPI document', () => {
    const doc = openApiDocument('1.2.3');
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/api/trips/{id}/items/{key}');
    const ids = Object.values(doc.paths).flatMap((ops) =>
      Object.values(ops).map((op) => (op as { operationId: string }).operationId)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders the agent guide', () => {
    const text = llmsTxt('1.2.3');
    expect(text).toContain('# packing-master');
    expect(text).toContain('POST /api/trips/{id}/regenerate');
  });
});
