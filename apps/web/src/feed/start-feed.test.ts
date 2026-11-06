import type { FrameScheduler } from '@nerkh/ws-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceHistory } from '@/store/history';
import { createQuotesStore } from '@/store/quotes';
import { startFeed } from './start-feed';

/** Frames happen every 16 ms on the fake clock. */
const timerScheduler: FrameScheduler = {
  request: (cb) => setTimeout(cb, 16),
  cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startFeed (in-browser mock market)', () => {
  it('fills the store with the requested symbols, a few updates per frame at most', () => {
    const store = createQuotesStore();
    const stop = startFeed({
      symbols: ['BTC-EUR', 'ETH-EUR', 'EUR-USD'],
      actions: store.getState(),
      scheduler: timerScheduler,
    });
    expect(store.getState().connection.status).toBe('connected');

    vi.advanceTimersByTime(1000);
    const state = store.getState();
    expect(new Set(state.symbols)).toEqual(new Set(['BTC-EUR', 'ETH-EUR', 'EUR-USD']));
    // ~200 quotes arrived, but the store updated at most once per 16 ms frame
    expect(state.batches).toBeGreaterThan(0);
    expect(state.batches).toBeLessThanOrEqual(Math.ceil(1000 / 16));
    stop();
  });

  it('backfills chart history once per symbol and extends it with live quotes', () => {
    const store = createQuotesStore();
    const history = new PriceHistory();
    const stop = startFeed({
      symbols: ['BTC-EUR'],
      actions: store.getState(),
      history,
      scheduler: timerScheduler,
    });
    const start = Date.now();
    expect(history.series('BTC-EUR', '1D', start).length).toBeGreaterThan(200); // backfilled day
    vi.advanceTimersByTime(3000);
    const latest = history.series('BTC-EUR', '1m', Date.now()).at(-1);
    expect(latest?.t).toBeGreaterThan(start); // live points appended after the backfill
    expect(latest?.p).toBe(store.getState().entries['BTC-EUR']?.quote.price);
    stop();
  });

  it('reports every incoming batch before batching (for the rate meter)', () => {
    const store = createQuotesStore();
    let received = 0;
    const stop = startFeed({
      symbols: ['BTC-EUR', 'ETH-EUR'],
      actions: store.getState(),
      onReceived: (quotes) => (received += quotes.length),
      scheduler: timerScheduler,
    });
    vi.advanceTimersByTime(1000);
    expect(received).toBe(200); // default mock rate, counted before coalescing
    stop();
  });

  it('stop() ends updates and marks the feed paused', () => {
    const store = createQuotesStore();
    const stop = startFeed({ symbols: ['BTC-EUR'], actions: store.getState(), scheduler: timerScheduler });
    vi.advanceTimersByTime(200);
    stop();
    const batches = store.getState().batches;
    vi.advanceTimersByTime(2000);
    expect(store.getState().batches).toBe(batches);
    expect(store.getState().connection.status).toBe('paused');
    expect(vi.getTimerCount()).toBe(0);
  });
});
