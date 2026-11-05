import { describe, expect, it } from 'vitest';
import { createMockOrderBook } from './orderbook.ts';
import { MOCK_SYMBOLS } from './symbols.ts';

describe('createMockOrderBook', () => {
  it('is repeatable for the same seed and changes with the seed', () => {
    const a = createMockOrderBook('BTC-EUR', { mid: 63412.5, seed: 3 });
    expect(createMockOrderBook('BTC-EUR', { mid: 63412.5, seed: 3 })).toEqual(a);
    expect(createMockOrderBook('BTC-EUR', { mid: 63412.5, seed: 4 })).not.toEqual(a);
  });

  it('asks rise from above mid, bids fall from below mid, spread = best ask − best bid', () => {
    const book = createMockOrderBook('BTC-EUR', { mid: 63412.5 });
    if (!book) throw new Error('no book');
    expect(book.asks).toHaveLength(7);
    expect(book.bids).toHaveLength(7);
    expect(book.asks[0]?.price).toBeGreaterThan(63412.5);
    expect(book.bids[0]?.price).toBeLessThan(63412.5);
    for (let i = 1; i < 7; i++) {
      expect(book.asks[i]?.price).toBeGreaterThan(book.asks[i - 1]?.price ?? 0);
      expect(book.bids[i]?.price).toBeLessThan(book.bids[i - 1]?.price ?? Infinity);
    }
    expect(book.spread).toBeCloseTo((book.asks[0]?.price ?? 0) - (book.bids[0]?.price ?? 0), 6);
  });

  it('depth runs from the best price to 1 on each side', () => {
    const book = createMockOrderBook('ETH-EUR', { mid: 3108.22 });
    for (const side of [book?.asks ?? [], book?.bids ?? []]) {
      expect(side.at(-1)?.depth).toBeCloseTo(1, 10);
      for (let i = 1; i < side.length; i++) expect(side[i]?.depth).toBeGreaterThan(side[i - 1]?.depth ?? 1);
    }
  });

  it('prices sit on the symbol tick for every mock symbol, spread at least one tick', () => {
    for (const s of MOCK_SYMBOLS) {
      const book = createMockOrderBook(s.symbol, { mid: s.basePrice });
      const tick = 10 ** -s.decimals;
      expect(book?.spread).toBeGreaterThanOrEqual(tick - 1e-12);
      for (const l of [...(book?.asks ?? []), ...(book?.bids ?? [])]) {
        expect(Number(l.price.toFixed(s.decimals))).toBe(l.price);
        expect(l.size).toBeGreaterThan(0);
      }
    }
  });

  it('returns null for unknown symbols or a bad mid price', () => {
    expect(createMockOrderBook('NOPE-EUR', { mid: 1 })).toBeNull();
    expect(createMockOrderBook('BTC-EUR', { mid: 0 })).toBeNull();
    expect(createMockOrderBook('BTC-EUR', { mid: Number.NaN })).toBeNull();
  });
});
