import type { Quote } from '@nerkh/data';

/** Schedules one callback before the next paint. Injected in tests. */
export interface FrameScheduler {
  request(callback: () => void): unknown;
  cancel(handle: unknown): void;
}

interface RafGlobals {
  requestAnimationFrame?: (cb: () => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
}

/**
 * requestAnimationFrame where it exists (browsers), otherwise a ~60 fps timer
 * (Node, tests). In a hidden tab the browser pauses rAF: nothing is drawn, so
 * nothing needs flushing, and only the latest quote per symbol is kept meanwhile.
 */
export function defaultFrameScheduler(): FrameScheduler {
  const g = globalThis as RafGlobals;
  if (g.requestAnimationFrame && g.cancelAnimationFrame) {
    const raf = g.requestAnimationFrame;
    const caf = g.cancelAnimationFrame;
    return { request: (cb) => raf(cb), cancel: (h) => caf(h as number) };
  }
  return {
    request: (cb) => setTimeout(cb, 16),
    cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

export interface BatcherStats {
  /** Quotes handed to add(). */
  received: number;
  /** Quotes replaced by a newer one for the same symbol before they were flushed. */
  coalesced: number;
  /** Batches delivered. */
  flushes: number;
  /** Size of the last delivered batch. */
  lastBatchSize: number;
}

export interface QuoteBatcher {
  add(quotes: readonly Quote[]): void;
  /** Deliver what is pending right now (e.g. before a snapshot replaces the store). */
  flush(): void;
  /** Drop pending quotes and stop scheduling. add() after stop() does nothing. */
  stop(): void;
  readonly stats: Readonly<BatcherStats>;
}

export interface QuoteBatcherOptions {
  /** Receives one batch per frame: at most one quote per symbol, the newest. */
  onFlush: (quotes: Quote[]) => void;
  scheduler?: FrameScheduler;
}

/**
 * Collects quotes and delivers them once per animation frame, so 200 messages
 * a second cause at most ~60 store updates (one per frame) instead of 200.
 */
export function createQuoteBatcher({
  onFlush,
  scheduler = defaultFrameScheduler(),
}: QuoteBatcherOptions): QuoteBatcher {
  const pending = new Map<string, Quote>();
  const stats: BatcherStats = { received: 0, coalesced: 0, flushes: 0, lastBatchSize: 0 };
  let handle: unknown;
  let scheduled = false;
  let stopped = false;

  function flush(): void {
    if (scheduled) scheduler.cancel(handle);
    scheduled = false;
    if (pending.size === 0) return;
    const batch = [...pending.values()];
    pending.clear();
    stats.flushes += 1;
    stats.lastBatchSize = batch.length;
    onFlush(batch);
  }

  return {
    add(quotes) {
      if (stopped || quotes.length === 0) return;
      for (const quote of quotes) {
        stats.received += 1;
        const current = pending.get(quote.symbol);
        if (current) {
          stats.coalesced += 1;
          // Out-of-order delivery: never replace a newer price with an older one.
          if (quote.updatedAt < current.updatedAt) continue;
        }
        pending.set(quote.symbol, quote);
      }
      if (!scheduled) {
        scheduled = true;
        handle = scheduler.request(flush);
      }
    },
    flush,
    stop() {
      stopped = true;
      if (scheduled) scheduler.cancel(handle);
      scheduled = false;
      pending.clear();
    },
    get stats() {
      return stats;
    },
  };
}
