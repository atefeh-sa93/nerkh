import { describe, expect, it } from 'vitest';
import { createFeedStore, RATE_WINDOW, RateCounter } from '@/store/feed';
import { describeConnection, lastSecond, rateBars } from './status';

describe('describeConnection', () => {
  it('says what the stream is doing, with a tone for colour', () => {
    expect(describeConnection({ status: 'connected', attempt: 0 }, 184)).toEqual({
      text: 'Connected · 184 msg/s',
      tone: 'live',
    });
    expect(describeConnection({ status: 'reconnecting', attempt: 2, nextRetryMs: 1800 }, 0)).toEqual({
      text: 'Reconnecting in 2s (attempt 2)',
      tone: 'stale',
    });
    expect(describeConnection({ status: 'paused', attempt: 0 }, 0).text).toBe('Paused');
    expect(describeConnection({ status: 'failed', attempt: 10 }, 0).tone).toBe('stale');
  });
});

describe('rateBars', () => {
  it('scales to the busiest second and aligns to the right edge', () => {
    const bars = rateBars(
      [
        { messages: 100, updates: 60, state: 'ok' },
        { messages: 200, updates: 60, state: 'ok' },
      ],
      60,
      50,
    );
    expect(bars).toEqual([
      { x: 58, height: 25, state: 'ok' },
      { x: 59, height: 50, state: 'ok' },
    ]);
  });

  it('keeps a visible stub for disconnected and paused seconds', () => {
    const bars = rateBars(
      [
        { messages: 0, updates: 0, state: 'down' },
        { messages: 0, updates: 0, state: 'paused' },
      ],
      60,
      50,
    );
    expect(bars.map((b) => b.height)).toEqual([4, 4]);
  });
});

describe('feed store', () => {
  it('keeps only the last 60 seconds and the newest quote time', () => {
    const store = createFeedStore();
    for (let i = 0; i < 75; i++) store.getState().recordSecond({ messages: i, updates: 1, state: 'ok' }, i);
    expect(store.getState().seconds).toHaveLength(RATE_WINDOW);
    expect(store.getState().seconds[0]?.messages).toBe(15);
    expect(lastSecond(store.getState().seconds).messages).toBe(74);
    store.getState().recordSecond({ messages: 0, updates: 0, state: 'paused' }, null);
    expect(store.getState().lastQuoteAt).toBe(74); // a quiet second doesn't erase it
  });

  it('counts reconnects and the paused flag', () => {
    const store = createFeedStore();
    store.getState().noteReconnect();
    store.getState().setPaused(true);
    expect(store.getState()).toMatchObject({ reconnects: 1, paused: true });
  });
});

describe('RateCounter', () => {
  it('counts per tick and remembers the newest quote time', () => {
    const counter = new RateCounter();
    const q = (updatedAt: number) => ({
      symbol: 'BTC-EUR',
      name: { en: 'Bitcoin' },
      price: 1,
      currency: 'EUR' as const,
      change24h: null,
      kind: 'stream' as const,
      source: 'test',
      updatedAt,
    });
    counter.add([q(5), q(9)]);
    counter.add([q(7)]);
    expect(counter.take()).toEqual({ messages: 3, newest: 9 });
    expect(counter.take()).toEqual({ messages: 0, newest: 9 });
  });
});
