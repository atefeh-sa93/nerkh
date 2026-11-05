// Web Worker entry: receives raw text frames, sends back ParseOutcome[].
// Parsing JSON and validating with Zod here keeps that work off the main
// thread, where the UI renders.
import { parseServerMessage, type ParseOutcome } from './parse.ts';

/** Messages into the worker: one frame or several. */
export type WorkerRequest = string | string[];
/** Messages out of the worker: one outcome per frame, in order. */
export type WorkerResponse = ParseOutcome[];

// The worker global, typed narrowly so this file needs no WebWorker lib.
interface WorkerScope {
  onmessage: ((event: { data: WorkerRequest }) => void) | null;
  postMessage(message: WorkerResponse): void;
}
const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  const frames = Array.isArray(event.data) ? event.data : [event.data];
  scope.postMessage(frames.map(parseServerMessage));
};
