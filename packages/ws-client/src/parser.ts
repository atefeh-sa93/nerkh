import { parseServerMessage, type ParseOutcome } from './parse.ts';
import type { WorkerRequest, WorkerResponse } from './worker.ts';

/** The part of a Worker the parser uses; a real Worker fits, tests pass a fake. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export interface ParserStats {
  /** Raw frames handed to the parser. */
  frames: number;
  /** Valid quotes delivered. */
  quotes: number;
  /** Quotes dropped by schema validation. */
  rejectedQuotes: number;
  /** Frames that were not usable at all (bad JSON, wrong shape). */
  invalidFrames: number;
  /** Where parsing runs right now. */
  mode: 'worker' | 'main-thread';
}

export interface MessageParser {
  parse(raw: string): void;
  readonly stats: Readonly<ParserStats>;
  /** Stops the worker; later frames are parsed on the main thread. */
  terminate(): void;
}

export interface MessageParserOptions {
  /** Parse off the main thread. Omit (or pass null) to parse inline, e.g. in Node or tests. */
  worker?: WorkerLike | null;
  /** Called with each outcome, in arrival order. */
  onResult: (outcome: ParseOutcome) => void;
  /**
   * A worker that fails to load does not always report an error (a bad script
   * URL can leave it silently dead). If it has not answered this long after the
   * first frame, the parser gives up on it. Default 3000 ms.
   */
  workerTimeoutMs?: number;
}

/** Frames kept while waiting for the worker's first answer, so none are lost on fallback. */
const MAX_UNCONFIRMED = 2000;

/**
 * Bridge between the socket and the parsing logic. Uses the worker when there
 * is one and falls back to the main thread if the worker errors or never
 * answers, re-parsing anything it was handed, so a missing, broken or crashed
 * worker never stops the stream.
 */
export function createMessageParser({
  worker = null,
  onResult,
  workerTimeoutMs = 3000,
}: MessageParserOptions): MessageParser {
  const stats: ParserStats = {
    frames: 0,
    quotes: 0,
    rejectedQuotes: 0,
    invalidFrames: 0,
    mode: worker ? 'worker' : 'main-thread',
  };
  let active: WorkerLike | null = worker;
  /** Frames posted before the worker proved it works; null once it has. */
  let unconfirmed: string[] | null = worker ? [] : null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function deliver(outcome: ParseOutcome): void {
    if (outcome.kind === 'quotes') {
      stats.quotes += outcome.quotes.length;
      stats.rejectedQuotes += outcome.rejected;
    } else if (outcome.kind === 'invalid') {
      stats.invalidFrames += 1;
    }
    onResult(outcome);
  }

  function stopWorker(): void {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
    if (!active) return;
    active.onmessage = active.onerror = null;
    active.terminate();
    active = null;
    stats.mode = 'main-thread';
  }

  /** Worker failed: switch to the main thread and parse what it never answered. */
  function fallBack(): void {
    const pending = unconfirmed ?? [];
    unconfirmed = null;
    stopWorker();
    for (const raw of pending) deliver(parseServerMessage(raw));
  }

  if (active) {
    active.onmessage = (event) => {
      if (unconfirmed) {
        // First answer: the worker works. Stop keeping copies.
        unconfirmed = null;
        if (timeout !== undefined) clearTimeout(timeout);
        timeout = undefined;
      }
      event.data.forEach(deliver);
    };
    active.onerror = fallBack;
  }

  return {
    parse(raw) {
      stats.frames += 1;
      if (!active) {
        deliver(parseServerMessage(raw));
        return;
      }
      if (unconfirmed) {
        if (unconfirmed.length < MAX_UNCONFIRMED) unconfirmed.push(raw);
        timeout ??= setTimeout(fallBack, workerTimeoutMs);
      }
      active.postMessage(raw);
    },
    get stats() {
      return stats;
    },
    terminate() {
      unconfirmed = null;
      stopWorker();
    },
  };
}
