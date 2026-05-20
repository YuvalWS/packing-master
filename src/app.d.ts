declare global {
  namespace App {
    interface Error {
      error: string;
      details?: unknown;
      issues?: unknown;
      message?: string;
    }
  }
}

export {};
