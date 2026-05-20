import type { Pool } from 'mysql2/promise';

interface BuildOpts {
  method?: string;
  url?: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

// Returns `any` so the helper is assignable to any route's specific
// RequestEvent<RouteParams, RouteId>. Tests don't need the strict typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEvent(pool: Pool, opts: BuildOpts = {}): any {
  const method = opts.method ?? 'GET';
  const url = new URL(opts.url ?? 'http://localhost/test');
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const request = new Request(url, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });

  return {
    cookies: undefined,
    fetch: globalThis.fetch.bind(globalThis),
    getClientAddress: () => '127.0.0.1',
    locals: { pool },
    params: opts.params ?? {},
    platform: undefined,
    request,
    route: { id: null },
    setHeaders: () => undefined,
    url,
    isDataRequest: false,
    isSubRequest: false
  };
}

export async function expectJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`expected JSON, got: ${text.slice(0, 200)}`);
  }
}
