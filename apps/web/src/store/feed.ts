import type { Quote, QuoteKind } from '@nerkh/data';
import { createStore } from 'zustand/vanilla';

/** Seconds of history in the rate chart. */
export const RATE_WINDOW = 60;

/** What happened in one second of the stream. */
export type SecondState = 'ok' | 'down' | 'paused';

export interface Second {
  /** Quotes received in that second. */
  messages: number;
  /** Store updates (one per animation frame at most) in that second. */
  updates: number;
  state: SecondState;
}

export interface SourceInfo {
  id: string;
  /** Shown on the card, e.g. "In-browser mock" or "ws://localhost:4517". */
  label: string;
  kind: QuoteKind;
  /** Short transport description, e.g. "in-browser" or "WebSocket". */
  transport: string;
}

export interface FeedState {
  /** Set by the Pause button; the feed stops while true. */
  paused: boolean;
  source: SourceInfo | null;
  /** Last RATE_WINDOW seconds, oldest first. */
  seconds: Second[];
  /** Newest `updatedAt` seen from the source, for the freshness bar. */
  lastQuoteAt: number | null;
  /** Times the connection dropped and came back. */
  reconnects: number;

  setPaused(paused: boolean): void;
  setSource(source: SourceInfo | null): void;
  recordSecond(second: Second, lastQuoteAt: number | null): void;
  noteReconnect(): void;
}

export function createFeedStore() {
  return createStore<FeedState>()((set) => ({
    paused: false,
    source: null,
    seconds: [],
    lastQuoteAt: null,
    reconnects: 0,

    setPaused: (paused) => set({ paused }),
    setSource: (source) => set({ source }),
    recordSecond: (second, lastQuoteAt) =>
      set((state) => ({
        seconds: [...state.seconds, second].slice(-RATE_WINDOW),
        lastQuoteAt: lastQuoteAt ?? state.lastQuoteAt,
      })),
    noteReconnect: () => set((state) => ({ reconnects: state.reconnects + 1 })),
  }));
}

export const feedStore = createFeedStore();

/**
 * Counts what arrives between two ticks of the 1-second meter. The feed calls
 * add() for every batch handed to the batcher; the meter calls take() once a second.
 */
export class RateCounter {
  private count = 0;
  private newest: number | null = null;

  add(quotes: readonly Quote[]): void {
    this.count += quotes.length;
    for (const q of quotes) if (this.newest === null || q.updatedAt > this.newest) this.newest = q.updatedAt;
  }

  /** Returns and resets the count; `newest` is the latest quote time seen so far (not reset). */
  take(): { messages: number; newest: number | null } {
    const messages = this.count;
    this.count = 0;
    return { messages, newest: this.newest };
  }
}

export const rateCounter = new RateCounter();
