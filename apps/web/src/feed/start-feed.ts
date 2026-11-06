import { createMockAdapter, createMockHistory, type Quote } from '@nerkh/data';
import {
  createMessageParser,
  createQuoteBatcher,
  createWsClient,
  type FrameScheduler,
  type StatusInfo,
} from '@nerkh/ws-client';
import { createParserWorker } from '@nerkh/ws-client/browser';
import type { PriceHistory } from '@/store/history';
import type { QuotesState } from '@/store/quotes';

export type FeedActions = Pick<QuotesState, 'applyBatch' | 'setConnection'>;

export interface FeedOptions {
  symbols: string[];
  actions: FeedActions;
  /**
   * WebSocket server, e.g. ws://localhost:4000. Without it the mock market
   * runs inside the browser, which is what the static public demo uses.
   */
  wsUrl?: string;
  /** Chart history: backfilled for each symbol, then extended with every batch. */
  history?: PriceHistory;
  /** Called with every batch of quotes as it arrives, before batching (for the rate meter). */
  onReceived?: (quotes: Quote[]) => void;
  /** Called when the connection comes back after a drop. */
  onReconnected?: () => void;
  /**
   * Off: every quote goes to the store on its own, the moment it arrives.
   * Only for measuring what batching saves (ADR-002). Default true.
   */
  batching?: boolean;
  /** Off: parse on the main thread even where Workers exist. For measuring (ADR-002). Default true. */
  useWorker?: boolean;
  /** Injected in tests. */
  scheduler?: FrameScheduler;
}

/** Illustrative backfill so the 1h and 1D charts aren't empty on first load (mock data only). */
function backfill(history: PriceHistory, symbols: readonly string[], now: number): void {
  for (const symbol of symbols) {
    if (history.has(symbol)) continue;
    history.seed(
      symbol,
      createMockHistory(symbol, { end: now, stepMs: 1000, points: 3600 }),
      createMockHistory(symbol, { end: now, stepMs: 60_000, points: 1440 }),
    );
  }
}

/**
 * Wires a data source to the store: source → (parser) → per-frame batcher →
 * store.applyBatch (+ chart history). Returns a stop function that tears everything down.
 */
export function startFeed({
  symbols,
  actions,
  wsUrl,
  history,
  onReceived,
  onReconnected,
  batching = true,
  useWorker = true,
  scheduler,
}: FeedOptions): () => void {
  if (history) backfill(history, symbols, Date.now());
  const apply = (quotes: Quote[]) => {
    actions.applyBatch(quotes);
    history?.append(quotes);
  };
  const batcher = createQuoteBatcher({ onFlush: apply, ...(scheduler ? { scheduler } : {}) });
  const receive = (quotes: Quote[]) => {
    onReceived?.(quotes);
    if (batching) batcher.add(quotes);
    else for (const quote of quotes) apply([quote]);
  };

  if (!wsUrl) {
    const adapter = createMockAdapter({ seed: Date.now() % 100_000 });
    const connected: StatusInfo = { status: 'connected', attempt: 0 };
    actions.setConnection(connected);
    const unsubscribe = adapter.subscribe?.(symbols, receive) ?? (() => undefined);
    return () => {
      unsubscribe();
      batcher.stop();
      actions.setConnection({ status: 'paused', attempt: 0 });
    };
  }

  const parser = createMessageParser({
    worker: useWorker ? createParserWorker() : null,
    onResult: (outcome) => {
      if (outcome.kind === 'quotes') receive(outcome.quotes);
    },
  });
  const client = createWsClient({ url: wsUrl });
  client.on('status', actions.setConnection);
  client.on('open', ({ reconnected }) => {
    if (reconnected) onReconnected?.();
  });
  client.on('message', (raw) => parser.parse(raw));
  client.setSubscription(JSON.stringify({ type: 'subscribe', symbols }));
  client.connect();

  return () => {
    client.close();
    batcher.stop();
    parser.terminate();
  };
}
