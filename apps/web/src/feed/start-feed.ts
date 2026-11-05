import { createMockAdapter, createMockHistory } from '@nerkh/data';
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
export function startFeed({ symbols, actions, wsUrl, history, scheduler }: FeedOptions): () => void {
  if (history) backfill(history, symbols, Date.now());
  const batcher = createQuoteBatcher({
    onFlush: (quotes) => {
      actions.applyBatch(quotes);
      history?.append(quotes);
    },
    ...(scheduler ? { scheduler } : {}),
  });

  if (!wsUrl) {
    const adapter = createMockAdapter({ seed: Date.now() % 100_000 });
    const connected: StatusInfo = { status: 'connected', attempt: 0 };
    actions.setConnection(connected);
    const unsubscribe = adapter.subscribe?.(symbols, (quotes) => batcher.add(quotes)) ?? (() => undefined);
    return () => {
      unsubscribe();
      batcher.stop();
      actions.setConnection({ status: 'paused', attempt: 0 });
    };
  }

  const parser = createMessageParser({
    worker: createParserWorker(),
    onResult: (outcome) => {
      if (outcome.kind === 'quotes') batcher.add(outcome.quotes);
    },
  });
  const client = createWsClient({ url: wsUrl });
  client.on('status', actions.setConnection);
  client.on('message', (raw) => parser.parse(raw));
  client.setSubscription(JSON.stringify({ type: 'subscribe', symbols }));
  client.connect();

  return () => {
    client.close();
    batcher.stop();
    parser.terminate();
  };
}
