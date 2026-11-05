import type { WorkerLike } from './parser.ts';

// Typed narrowly so this file also compiles where there are no DOM types (Node apps).
type WorkerConstructor = new (url: URL, options: { type: 'module' }) => WorkerLike;

/**
 * Starts the parsing worker in a browser. The `new Worker(new URL(...,
 * import.meta.url))` form is what Next.js (webpack) and Vite detect to bundle
 * the worker file. Returns null where Workers don't exist (Node, old browsers),
 * and the parser then runs on the main thread.
 */
export function createParserWorker(): WorkerLike | null {
  const Worker = (globalThis as { Worker?: WorkerConstructor }).Worker;
  if (!Worker) return null;
  try {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}
