import type { Quote } from '@nerkh/data';
import type { StatusInfo } from '@nerkh/ws-client';
import { createStore } from 'zustand/vanilla';

export type Direction = 'up' | 'down' | 'flat';

/** What the UI needs per symbol: the latest quote and how it moved. */
export interface QuoteEntry {
  quote: Quote;
  /** Price before the latest update, or null for the first quote. */
  previousPrice: number | null;
  /** Direction of the latest update; drives the row flash and arrow. */
  direction: Direction;
  /** Local time the entry last changed (for the flash timing). */
  changedAt: number;
}

export interface QuotesState {
  /**
   * Latest entry per symbol. An update replaces only the entries that changed;
   * untouched entries keep their object identity, so components selecting
   * them do not re-render.
   */
  entries: Readonly<Record<string, QuoteEntry>>;
  /** Symbols in first-seen order. Same array until a new symbol appears. */
  symbols: readonly string[];
  selected: string | null;
  connection: StatusInfo;
  /** Store updates applied (one per animation frame at most). */
  batches: number;

  applyBatch(quotes: readonly Quote[], now?: number): void;
  select(symbol: string | null): void;
  setConnection(info: StatusInfo): void;
  reset(): void;
}

const initial = {
  entries: {},
  symbols: [],
  selected: null,
  connection: { status: 'idle', attempt: 0 } as StatusInfo,
  batches: 0,
} satisfies Partial<QuotesState>;

function directionOf(previous: number, next: number): Direction {
  if (next > previous) return 'up';
  if (next < previous) return 'down';
  return 'flat';
}

/** A fresh store; the app uses one shared instance, tests make their own. */
export function createQuotesStore() {
  return createStore<QuotesState>()((set, get) => ({
    ...initial,

    applyBatch(quotes, now = Date.now()) {
      if (quotes.length === 0) return;
      const { entries, symbols, selected } = get();
      let nextEntries: Record<string, QuoteEntry> | null = null;
      let nextSymbols: string[] | null = null;

      for (const quote of quotes) {
        const current = (nextEntries ?? entries)[quote.symbol];
        // Never let an older price replace a newer one.
        if (current && quote.updatedAt < current.quote.updatedAt) continue;

        nextEntries ??= { ...entries };
        nextEntries[quote.symbol] = {
          quote,
          previousPrice: current ? current.quote.price : null,
          direction: current ? directionOf(current.quote.price, quote.price) : 'flat',
          changedAt: now,
        };
        if (!current) {
          nextSymbols ??= [...symbols];
          nextSymbols.push(quote.symbol);
        }
      }
      if (!nextEntries) return;

      set((state) => ({
        entries: nextEntries,
        symbols: nextSymbols ?? state.symbols,
        // Select the first symbol we ever see, so the chart is never empty.
        selected: selected ?? nextSymbols?.[0] ?? state.selected,
        batches: state.batches + 1,
      }));
    },

    select(symbol) {
      if (symbol !== null && !(symbol in get().entries)) return;
      set({ selected: symbol });
    },

    setConnection(info) {
      set({ connection: info });
    },

    reset() {
      set({ ...initial });
    },
  }));
}

export type QuotesStore = ReturnType<typeof createQuotesStore>;

/** The app's shared store. */
export const quotesStore = createQuotesStore();
