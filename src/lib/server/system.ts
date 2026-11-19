import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { APP_VERSION } from './version.js';

/*
 * The in-app "Update" button. The app runs unprivileged inside a container, so it never
 * updates itself: it drops a request file into CONTROL_DIR (a directory shared with the
 * LXC host), and systemd path units installed by proxmox/install.sh run the update or
 * the version check as root, writing their results back into the same directory.
 */

const Installed = z.object({
  commit: z.string(),
  date: z.string().optional(),
  branch: z.string().optional(),
  repo: z.string().optional()
});
const Latest = z.object({
  commit: z.string().nullable(),
  checked_at: z.string(),
  changes: z.array(z.string()).default([]),
  error: z.string().nullable().optional()
});

export type Installed = z.infer<typeof Installed>;
export type Latest = z.infer<typeof Latest>;

export interface SystemInfo {
  version: string;
  installed: Installed | null;
  latest: Latest | null;
  update_available: boolean | null;
  can_update: boolean;
  update_requested: boolean;
  check_requested: boolean;
  update_log: string[];
  update_log_time: string | null;
}

export function controlDir(): string | null {
  return process.env.CONTROL_DIR || null;
}

async function readJson<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(await readFile(file, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false
  );
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const dir = controlDir();
  if (!dir) {
    return {
      version: APP_VERSION,
      installed: null,
      latest: null,
      update_available: null,
      can_update: false,
      update_requested: false,
      check_requested: false,
      update_log: [],
      update_log_time: null
    };
  }
  const [installed, latest, updateRequested, checkRequested] = await Promise.all([
    readJson(path.join(dir, 'installed.json'), Installed),
    readJson(path.join(dir, 'latest.json'), Latest),
    exists(path.join(dir, 'update-request')),
    exists(path.join(dir, 'check-request'))
  ]);
  let log: string[] = [];
  let logTime: string | null = null;
  try {
    const logPath = path.join(dir, 'update.log');
    log = (await readFile(logPath, 'utf8')).split('\n').filter(Boolean).slice(-60);
    logTime = (await stat(logPath)).mtime.toISOString();
  } catch {
    // no update has run yet
  }
  const updateAvailable =
    installed && latest?.commit ? latest.commit !== installed.commit : null;
  return {
    version: APP_VERSION,
    installed,
    latest,
    update_available: updateAvailable,
    can_update: installed !== null,
    update_requested: updateRequested,
    check_requested: checkRequested,
    update_log: log,
    update_log_time: logTime
  };
}

export class SystemError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function request(file: 'update-request' | 'check-request'): Promise<void> {
  const dir = controlDir();
  if (!dir || !(await exists(path.join(dir, 'installed.json')))) {
    throw new SystemError('updates_not_available');
  }
  await writeFile(path.join(dir, file), new Date().toISOString() + '\n');
}

export const requestUpdate = () => request('update-request');
export const requestCheck = () => request('check-request');
