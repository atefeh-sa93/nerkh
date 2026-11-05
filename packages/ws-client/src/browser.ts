// Browser-only entry: `@nerkh/ws-client/browser`. Kept out of the main entry
// so Node apps (mock-server) never need DOM types.
import type { WorkerLike } from './parser.ts';

/**
 * Starts the parsing worker. The call must stay literally
 * `new Worker(new URL('./worker.ts', import.meta.url), ...)`: that exact
 * shape is what Turbopack, webpack and Vite detect to bundle the worker.
 * Wrapping `Worker` in a variable makes bundlers ship the raw .ts file instead.
 * Returns null where Workers don't exist; the parser then runs on the main thread.
 */
export function createParserWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
  } catch {
    return null;
  }
}
