import { ClientApiError, type ApiErrorPayload } from './api.js';

export interface BackupEntry {
  name: string;
  size: number;
  created_at: string;
  reason: string;
}

export interface SystemInfo {
  version: string;
  installed: { commit: string; date?: string; branch?: string } | null;
  latest: { commit: string | null; checked_at: string; changes: string[]; error?: string | null } | null;
  update_available: boolean | null;
  can_update: boolean;
  update_requested: boolean;
  check_requested: boolean;
  update_log: string[];
  update_log_time: string | null;
}

type Fetcher = typeof fetch;

async function call<T>(fetcher: Fetcher, method: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetcher(path, { method, ...init });
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

export function makeSystemApi(fetcher: Fetcher = fetch) {
  return {
    system: () => call<SystemInfo>(fetcher, 'GET', '/api/system'),
    checkForUpdate: () => call<{ requested: true }>(fetcher, 'POST', '/api/system/check'),
    update: () => call<{ requested: true }>(fetcher, 'POST', '/api/system/update'),
    listBackups: () => call<{ backups: BackupEntry[] }>(fetcher, 'GET', '/api/backups'),
    createBackup: () =>
      call<{ backup: BackupEntry }>(fetcher, 'POST', '/api/backups', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'manual' })
      }),
    uploadBackup: (file: Blob) =>
      call<{ backup: BackupEntry }>(fetcher, 'POST', '/api/backups/upload', {
        headers: { 'content-type': 'application/octet-stream' },
        body: file
      }),
    restoreBackup: (name: string) =>
      call<{ restored: Record<string, number> }>(
        fetcher,
        'POST',
        `/api/backups/${encodeURIComponent(name)}/restore`
      ),
    deleteBackup: (name: string) =>
      call<{ deleted: true }>(fetcher, 'DELETE', `/api/backups/${encodeURIComponent(name)}`),
    backupUrl: (name: string) => `/api/backups/${encodeURIComponent(name)}`
  };
}
