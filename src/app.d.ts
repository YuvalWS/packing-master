import type { Pool } from 'mysql2/promise';

declare global {
  namespace App {
    interface Error {
      error: string;
      details?: unknown;
      issues?: unknown;
      message?: string;
    }
    interface Locals {
      pool: Pool;
    }
  }
}

export {};
