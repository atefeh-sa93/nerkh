/** Currency a price is expressed in. Iranian prices are always stored in rial. */
export type Currency = 'IRR' | 'EUR' | 'USD';

/**
 * How a quote arrives:
 * - `stream`: pushed continuously over a WebSocket (mock stream, Nobitex)
 * - `periodic`: fetched on a schedule, e.g. every 15 minutes (price service, snapshot)
 */
export type QuoteKind = 'stream' | 'periodic';

/** The one shape every data source is converted into. Apps only know this type. */
export interface Quote {
  /** Base and quote asset joined by a dash, e.g. `USD-IRT`, `BTC-EUR`, `GOLD18-IRT`. */
  symbol: string;
  name: { en: string; fa?: string };
  /** In the smallest meaningful unit; for Iran that is rial. Toman exists only in the UI. */
  price: number;
  currency: Currency;
  /** Percent change over 24 hours, or `null` when the source does not provide it. */
  change24h: number | null;
  kind: QuoteKind;
  /** Source id shown in the UI for attribution, e.g. `nobitex`, `mock-stream`. */
  source: string;
  /** When the source last updated this price, epoch milliseconds. */
  updatedAt: number;
}

/**
 * Contract for a data source. A stream adapter implements `subscribe`,
 * a periodic adapter implements `fetch`. Adding a source means adding an adapter;
 * nothing else in the app changes.
 */
export interface QuoteAdapter {
  id: string;
  kind: QuoteKind;
  /** Stream sources: call `onQuotes` as data arrives. Returns an unsubscribe function. */
  subscribe?(symbols: string[], onQuotes: (quotes: Quote[]) => void): () => void;
  /** Periodic sources: fetch the latest quotes once. */
  fetch?(symbols: string[]): Promise<Quote[]>;
}
