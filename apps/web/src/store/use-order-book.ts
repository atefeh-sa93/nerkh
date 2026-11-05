'use client';

import { createMockOrderBook, type OrderBook } from '@nerkh/data';
import { useCallback, useSyncExternalStore } from 'react';
import { quotesStore } from './quotes';

/** The book redraws at this pace, not on every quote. */
export const BOOK_REFRESH_MS = 500;

const cache = new Map<string, { slot: number; book: OrderBook | null }>();

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, BOOK_REFRESH_MS);
  return () => clearInterval(id);
}

/**
 * Order book for a symbol, centred on its latest price and refreshed twice a
 * second. Reads the store directly instead of subscribing, so the ~20 price
 * updates a second don't re-render the book. Mock data: the seed changes per
 * refresh so sizes move.
 */
export function useOrderBook(symbol: string | null): OrderBook | null {
  const getSnapshot = useCallback(() => {
    if (!symbol) return null;
    const slot = Math.floor(Date.now() / BOOK_REFRESH_MS);
    const hit = cache.get(symbol);
    if (hit && hit.slot === slot) return hit.book;
    const mid = quotesStore.getState().entries[symbol]?.quote.price;
    const book = mid === undefined ? null : createMockOrderBook(symbol, { mid, seed: slot });
    cache.set(symbol, { slot, book });
    return book;
  }, [symbol]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
