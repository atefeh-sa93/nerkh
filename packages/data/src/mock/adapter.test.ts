import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseQuotes } from '../schema.ts';
import type { Quote } from '../quote.ts';
import { createMockAdapter, createMockQuoteGenerator } from './adapter.ts';
import { createSeededRandom } from './random.ts';
import { MOCK_SYMBOLS } from './symbols.ts';

const fixedClock = () => 1793866630000;

function take(seed: number, count: number): Quote[] {
  const generator = createMockQuoteGenerator({ seed, now: fixedClock });
  return Array.from({ length: count }, () => generator.next() as Quote);
}

describe('createSeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('stays within [0, 1)', () => {
    const r = createSeededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('createMockQuoteGenerator', () => {
  it('produces the same quotes for the same seed', () => {
    expect(take(42, 500)).toEqual(take(42, 500));
  });

  it('produces different quotes for a different seed', () => {
    expect(take(42, 50)).not.toEqual(take(43, 50));
  });

  it('only emits valid quotes (they pass the same schema as real sources)', () => {
    const { rejected } = parseQuotes(take(42, 2000));
    expect(rejected).toEqual([]);
  });

  it('covers both Global and Iran symbols, Iran ones in rial', () => {
    const quotes = take(42, 2000);
    const symbols = new Set(quotes.map((q) => q.symbol));
    expect(symbols).toEqual(new Set(MOCK_SYMBOLS.map((s) => s.symbol)));
    for (const q of quotes.filter((q) => q.symbol.endsWith('-IRT'))) {
      expect(q.currency).toBe('IRR');
      expect(Number.isInteger(q.price)).toBe(true);
    }
  });

  it('keeps prices near their base price', () => {
    for (const q of take(42, 5000)) {
      const base = MOCK_SYMBOLS.find((s) => s.symbol === q.symbol)?.basePrice as number;
      expect(Math.abs(q.price - base) / base).toBeLessThan(0.1);
    }
  });

  it('only emits requested symbols and ignores unknown ones', () => {
    const generator = createMockQuoteGenerator({ seed: 1 });
    const quotes = Array.from({ length: 100 }, () => generator.next(['USD-IRT', 'NOPE-EUR']));
    expect(new Set(quotes.map((q) => q?.symbol))).toEqual(new Set(['USD-IRT']));
    expect(generator.next(['NOPE-EUR'])).toBeUndefined();
  });
});

describe('createMockAdapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a stream adapter', () => {
    const adapter = createMockAdapter();
    expect(adapter.kind).toBe('stream');
    expect(adapter.subscribe).toBeTypeOf('function');
  });

  it('emits about messagesPerSecond quotes, in batches', () => {
    const adapter = createMockAdapter({ messagesPerSecond: 200, tickMs: 50 });
    const batches: Quote[][] = [];
    adapter.subscribe?.(['BTC-EUR', 'USD-IRT'], (b) => batches.push(b));

    vi.advanceTimersByTime(1000);

    expect(batches).toHaveLength(20); // one batch per 50 ms tick
    expect(batches.flat()).toHaveLength(200);
  });

  it('handles rates that do not divide evenly into ticks', () => {
    const adapter = createMockAdapter({ messagesPerSecond: 30, tickMs: 50 }); // 1.5 per tick
    let total = 0;
    adapter.subscribe?.(['BTC-EUR'], (b) => (total += b.length));
    vi.advanceTimersByTime(2000);
    expect(total).toBe(60);
  });

  it('stops emitting after unsubscribe', () => {
    const adapter = createMockAdapter();
    const onQuotes = vi.fn();
    const unsubscribe = adapter.subscribe?.(['BTC-EUR'], onQuotes) as () => void;

    vi.advanceTimersByTime(200);
    const callsBefore = onQuotes.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    unsubscribe();
    vi.advanceTimersByTime(1000);
    expect(onQuotes.mock.calls.length).toBe(callsBefore);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no timer when no requested symbol is known', () => {
    const adapter = createMockAdapter();
    adapter.subscribe?.(['NOPE-EUR'], vi.fn());
    expect(vi.getTimerCount()).toBe(0);
  });
});
