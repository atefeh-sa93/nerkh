import type { Quote } from '@nerkh/data';
import { describe, expect, it } from 'vitest';
import { selectConnection, selectEntry, selectSelectedEntry, selectSymbols } from './hooks';
import { createQuotesStore, type QuotesState } from './quotes';

function q(symbol: string, price: number, updatedAt = 1000): Quote {
  return {
    symbol,
    name: { en: symbol },
    price,
    currency: 'EUR',
    change24h: null,
    kind: 'stream',
    source: 'test',
    updatedAt,
  };
}

/**
 * Mirrors how Zustand's useStore decides to re-render: it re-runs the
 * selector after every store change and re-renders only if the result
 * is not Object.is-equal to the previous one.
 */
function countRenders<T>(store: ReturnType<typeof createQuotesStore>, selector: (s: QuotesState) => T) {
  let last = selector(store.getState());
  let renders = 0;
  store.subscribe((state) => {
    const next = selector(state);
    if (!Object.is(next, last)) renders++;
    last = next;
  });
  return () => renders;
}

describe('quotes store', () => {
  it('stores the latest quote per symbol and tracks direction', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100, 1)], 5);
    store.getState().applyBatch([q('BTC-EUR', 101, 2)], 6);
    expect(store.getState().entries['BTC-EUR']).toEqual({
      quote: q('BTC-EUR', 101, 2),
      previousPrice: 100,
      direction: 'up',
      changedAt: 6,
    });

    store.getState().applyBatch([q('BTC-EUR', 99, 3)]);
    expect(store.getState().entries['BTC-EUR']?.direction).toBe('down');
    store.getState().applyBatch([q('BTC-EUR', 99, 4)]);
    expect(store.getState().entries['BTC-EUR']?.direction).toBe('flat');
  });

  it('a first quote has no previous price and is flat', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('ETH-EUR', 10)]);
    expect(store.getState().entries['ETH-EUR']).toMatchObject({ previousPrice: null, direction: 'flat' });
  });

  it('keeps symbols in first-seen order and selects the first one', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('ETH-EUR', 10), q('BTC-EUR', 100)]);
    store.getState().applyBatch([q('SOL-EUR', 1), q('ETH-EUR', 11, 2000)]);
    expect(store.getState().symbols).toEqual(['ETH-EUR', 'BTC-EUR', 'SOL-EUR']);
    expect(store.getState().selected).toBe('ETH-EUR');
  });

  it('ignores a quote older than the one it has', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100, 50)]);
    store.getState().applyBatch([q('BTC-EUR', 1, 10)]);
    expect(store.getState().entries['BTC-EUR']?.quote.price).toBe(100);
    expect(store.getState().batches).toBe(1); // nothing changed, no update
  });

  it('counts one update per batch, not per quote', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('A-EUR', 1), q('B-EUR', 2), q('C-EUR', 3)]);
    store.getState().applyBatch([]);
    expect(store.getState().batches).toBe(1);
  });

  it('select() only accepts known symbols or null', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100), q('ETH-EUR', 10)]);
    store.getState().select('ETH-EUR');
    expect(store.getState().selected).toBe('ETH-EUR');
    store.getState().select('NOPE-EUR');
    expect(store.getState().selected).toBe('ETH-EUR');
    store.getState().select(null);
    expect(store.getState().selected).toBeNull();
  });

  it('reset() clears everything', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100)]);
    store.getState().setConnection({ status: 'connected', attempt: 0 });
    store.getState().reset();
    expect(store.getState()).toMatchObject({ entries: {}, symbols: [], selected: null, batches: 0 });
    expect(store.getState().connection.status).toBe('idle');
  });
});

describe('selectors: only the changed symbol re-renders', () => {
  it('a BTC update re-renders the BTC row, not the ETH row or the symbol list', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100), q('ETH-EUR', 10)]);

    const btcRenders = countRenders(store, selectEntry('BTC-EUR'));
    const ethRenders = countRenders(store, selectEntry('ETH-EUR'));
    const listRenders = countRenders(store, selectSymbols);

    for (let i = 1; i <= 5; i++) store.getState().applyBatch([q('BTC-EUR', 100 + i, 1000 + i)]);

    expect(btcRenders()).toBe(5);
    expect(ethRenders()).toBe(0);
    expect(listRenders()).toBe(0);
  });

  it('the symbol list changes only when a new symbol appears', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100)]);
    const listRenders = countRenders(store, selectSymbols);
    store.getState().applyBatch([q('BTC-EUR', 101, 2000)]);
    store.getState().applyBatch([q('ETH-EUR', 10)]);
    expect(listRenders()).toBe(1);
  });

  it('the chart follows only the selected symbol', () => {
    const store = createQuotesStore();
    store.getState().applyBatch([q('BTC-EUR', 100), q('ETH-EUR', 10)]); // BTC selected
    const chartRenders = countRenders(store, selectSelectedEntry);
    store.getState().applyBatch([q('ETH-EUR', 11, 2000)]);
    expect(chartRenders()).toBe(0);
    store.getState().applyBatch([q('BTC-EUR', 101, 2000)]);
    expect(chartRenders()).toBe(1);
    store.getState().select('ETH-EUR');
    expect(chartRenders()).toBe(2);
  });

  it('price updates do not re-render the connection status', () => {
    const store = createQuotesStore();
    const statusRenders = countRenders(store, selectConnection);
    store.getState().applyBatch([q('BTC-EUR', 100)]);
    expect(statusRenders()).toBe(0);
    store.getState().setConnection({ status: 'connected', attempt: 0 });
    expect(statusRenders()).toBe(1);
  });
});
