// The whole path in one place, the way the dashboard will wire it:
// socket → createWsClient → createMessageParser (Worker) → createQuoteBatcher → store.
// Each piece has its own tests; these check they work together.
import type { Quote } from '@nerkh/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuoteBatcher, type FrameScheduler } from './batcher.ts';
import { createWsClient, type SocketLike } from './client.ts';
import { parseServerMessage } from './parse.ts';
import { createMessageParser, type WorkerLike } from './parser.ts';
import type { WorkerRequest } from './worker.ts';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onerror: SocketLike['onerror'] = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  push(data: string) {
    this.onmessage?.({ data });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1012 });
  }
}

/** Runs the real parsing logic asynchronously, like a Web Worker. */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  postMessage(message: WorkerRequest) {
    const frames = Array.isArray(message) ? message : [message];
    const data = frames.map(parseServerMessage);
    queueMicrotask(() => this.onmessage?.({ data }));
  }
  terminate() {
    this.onmessage = null;
  }
}

function q(symbol: string, price: number, updatedAt: number): Quote {
  return {
    symbol,
    name: { en: symbol },
    price,
    currency: 'EUR',
    change24h: null,
    kind: 'stream',
    source: 'mock-stream',
    updatedAt,
  };
}
const quotesFrame = (...quotes: unknown[]) => JSON.stringify({ type: 'quotes', quotes });
const SUBSCRIBE = JSON.stringify({ type: 'subscribe', symbols: ['BTC-EUR', 'ETH-EUR'] });

/** Wires the pipeline exactly as an app would, with fakes at the edges. */
function pipeline(useWorker: boolean) {
  const sockets: FakeSocket[] = [];
  let frameCallback: (() => void) | null = null;
  const scheduler: FrameScheduler = {
    request: (cb) => (frameCallback = cb),
    cancel: () => (frameCallback = null),
  };

  /** The "store": latest price per symbol, plus how many updates it received. */
  const store = new Map<string, Quote>();
  let storeUpdates = 0;

  const client = createWsClient({
    url: 'ws://test',
    random: () => 0.5,
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
  });
  const batcher = createQuoteBatcher({
    scheduler,
    onFlush: (quotes) => {
      storeUpdates++;
      for (const quote of quotes) store.set(quote.symbol, quote);
    },
  });
  const parser = createMessageParser({
    worker: useWorker ? new FakeWorker() : null,
    onResult: (outcome) => {
      if (outcome.kind === 'quotes') batcher.add(outcome.quotes);
    },
  });
  client.on('message', (raw) => parser.parse(raw));
  client.setSubscription(SUBSCRIBE);

  return {
    client,
    parser,
    batcher,
    store,
    get storeUpdates() {
      return storeUpdates;
    },
    socket: () => sockets.at(-1) as FakeSocket,
    sockets,
    /** Let the (fake) worker answer, then paint one frame. */
    async frame() {
      await Promise.resolve();
      const cb = frameCallback;
      frameCallback = null;
      cb?.();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each([
  ['with a Worker', true],
  ['on the main thread', false],
])('pipeline %s', (_label, useWorker) => {
  it('turns many raw frames into one store update per frame with the newest prices', async () => {
    const p = pipeline(useWorker);
    p.client.connect();
    p.socket().open();
    expect(p.socket().sent).toEqual([SUBSCRIBE]);

    p.socket().push(quotesFrame(q('BTC-EUR', 100, 1), q('ETH-EUR', 10, 1)));
    p.socket().push(quotesFrame(q('BTC-EUR', 101, 2)));
    p.socket().push(quotesFrame(q('BTC-EUR', 102, 3)));
    await p.frame();

    expect(p.storeUpdates).toBe(1);
    expect(p.store.get('BTC-EUR')?.price).toBe(102);
    expect(p.store.get('ETH-EUR')?.price).toBe(10);
    expect(p.batcher.stats).toMatchObject({ received: 4, coalesced: 2, flushes: 1 });
  });

  it('keeps bad data out of the store and counts it', async () => {
    const p = pipeline(useWorker);
    p.client.connect();
    p.socket().open();

    p.socket().push('{not json');
    p.socket().push(JSON.stringify({ type: 'quotes', quotes: 'nope' }));
    p.socket().push(quotesFrame(q('BTC-EUR', 100, 1), { ...q('ETH-EUR', -5, 1) }, { symbol: 'x' }));
    p.socket().push(JSON.stringify({ type: 'subscribed', symbols: ['BTC-EUR'] }));
    await p.frame();

    expect([...p.store.keys()]).toEqual(['BTC-EUR']);
    expect(p.parser.stats).toMatchObject({ frames: 4, quotes: 1, rejectedQuotes: 2, invalidFrames: 2 });
  });

  it('survives a dropped connection: reconnects, resubscribes and keeps updating the store', async () => {
    const p = pipeline(useWorker);
    const reconnects: boolean[] = [];
    p.client.on('open', ({ reconnected }) => reconnects.push(reconnected));

    p.client.connect();
    p.socket().open();
    p.socket().push(quotesFrame(q('BTC-EUR', 100, 1)));
    await p.frame();

    p.socket().drop();
    expect(p.client.status).toBe('reconnecting');
    vi.advanceTimersByTime(1000);
    p.socket().open();

    expect(p.sockets).toHaveLength(2);
    expect(p.socket().sent).toEqual([SUBSCRIBE]);
    expect(reconnects).toEqual([false, true]);

    p.socket().push(quotesFrame(q('BTC-EUR', 105, 2)));
    await p.frame();
    expect(p.store.get('BTC-EUR')?.price).toBe(105);
    expect(p.storeUpdates).toBe(2);
  });

  it('stops cleanly: after close() and stop(), nothing reaches the store', async () => {
    const p = pipeline(useWorker);
    p.client.connect();
    p.socket().open();
    const last = p.socket();
    p.socket().push(quotesFrame(q('BTC-EUR', 100, 1)));

    p.client.close();
    p.batcher.stop();
    last.push(quotesFrame(q('BTC-EUR', 999, 9))); // a late frame from the old socket
    await p.frame();
    vi.advanceTimersByTime(60_000);

    expect(p.client.status).toBe('paused');
    expect(p.store.size).toBe(0);
    expect(p.sockets).toHaveLength(1);
  });
});
