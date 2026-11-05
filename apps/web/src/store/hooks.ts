'use client';

import { useStore } from 'zustand';
import { quotesStore, type QuoteEntry, type QuotesState } from './quotes';

// Each hook selects the smallest piece it needs. Zustand re-renders a
// component only when its selected value changes (Object.is), so a BTC
// update re-renders the BTC row and nothing else.

export const selectEntry =
  (symbol: string) =>
  (state: QuotesState): QuoteEntry | undefined =>
    state.entries[symbol];
export const selectSymbols = (state: QuotesState) => state.symbols;
export const selectSelected = (state: QuotesState) => state.selected;
export const selectSelectedEntry = (state: QuotesState) =>
  state.selected === null ? undefined : state.entries[state.selected];
export const selectConnection = (state: QuotesState) => state.connection;
export const selectBatches = (state: QuotesState) => state.batches;

/** One row's data. */
export const useQuoteEntry = (symbol: string) => useStore(quotesStore, selectEntry(symbol));
/** The list of symbols; changes only when a new symbol appears. */
export const useSymbols = () => useStore(quotesStore, selectSymbols);
export const useSelectedSymbol = () => useStore(quotesStore, selectSelected);
/** The selected symbol's entry, for the chart and order book. */
export const useSelectedEntry = () => useStore(quotesStore, selectSelectedEntry);
export const useConnection = () => useStore(quotesStore, selectConnection);
export const useBatchCount = () => useStore(quotesStore, selectBatches);

/** Actions never change, so reading them causes no re-renders. */
export const quoteActions = {
  applyBatch: quotesStore.getState().applyBatch,
  select: quotesStore.getState().select,
  setConnection: quotesStore.getState().setConnection,
  reset: quotesStore.getState().reset,
};
