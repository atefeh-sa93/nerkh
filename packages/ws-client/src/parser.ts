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
}

/**
 * Bridge between the socket and the parsing logic. Uses the worker when there
 * is one and falls back to the main thread if the worker fails, so a missing
 * or crashed worker never stops the stream.
 */
export function createMessageParser({ worker = null, onResult }: MessageParserOptions): MessageParser {
  const stats: ParserStats = {
    frames: 0,
    quotes: 0,
    rejectedQuotes: 0,
    invalidFrames: 0,
    mode: worker ? 'worker' : 'main-thread',
  };
  let active: WorkerLike | null = worker;

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
    if (!active) return;
    active.onmessage = active.onerror = null;
    active.terminate();
    active = null;
    stats.mode = 'main-thread';
  }

  if (active) {
    active.onmessage = (event) => event.data.forEach(deliver);
    active.onerror = stopWorker;
  }

  return {
    parse(raw) {
      stats.frames += 1;
      if (active) active.postMessage(raw);
      else deliver(parseServerMessage(raw));
    },
    get stats() {
      return stats;
    },
    terminate: stopWorker,
  };
}
