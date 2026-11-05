import { createMockAdapter } from '@nerkh/data';
import {
  createMessageParser,
  createQuoteBatcher,
  createWsClient,
  type FrameScheduler,
  type StatusInfo,
} from '@nerkh/ws-client';
import { createParserWorker } from '@nerkh/ws-client/browser';
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
  /** Injected in tests. */
  scheduler?: FrameScheduler;
}

/**
 * Wires a data source to the store: source → (parser) → per-frame batcher →
 * store.applyBatch. Returns a stop function that tears everything down.
 */
export function startFeed({ symbols, actions, wsUrl, scheduler }: FeedOptions): () => void {
  const batcher = createQuoteBatcher({ onFlush: actions.applyBatch, ...(scheduler ? { scheduler } : {}) });

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
