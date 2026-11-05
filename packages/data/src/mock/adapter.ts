import type { Quote, QuoteAdapter } from '../quote.ts';
import { createSeededRandom } from './random.ts';
import { MOCK_SYMBOLS, type MockSymbol } from './symbols.ts';

export const MOCK_SOURCE_ID = 'mock-stream';

export interface MockOptions {
  /** Same seed, same sequence of quotes. Default 42. */
  seed?: number;
  /** Clock used for `updatedAt`. Inject a fixed clock for repeatable output. */
  now?: () => number;
  /** Symbols the generator knows. Defaults to MOCK_SYMBOLS. */
  symbols?: readonly MockSymbol[];
}

export interface MockQuoteGenerator {
  /** Next quote for one of the given symbols (all known symbols when omitted). */
  next(symbols?: readonly string[]): Quote | undefined;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Pure, timer-free quote generator: a bounded random walk per symbol.
 * Used by the mock adapter, the mock server and tests.
 */
export function createMockQuoteGenerator(options: MockOptions = {}): MockQuoteGenerator {
  const { seed = 42, now = Date.now, symbols = MOCK_SYMBOLS } = options;
  const random = createSeededRandom(seed);
  const bySymbol = new Map(symbols.map((s) => [s.symbol, s]));
  const prices = new Map(symbols.map((s) => [s.symbol, s.basePrice]));

  return {
    next(requested) {
      const pool = requested ? requested.filter((s) => bySymbol.has(s)) : [...bySymbol.keys()];
      if (pool.length === 0) return undefined;

      const symbol = pool[Math.floor(random() * pool.length)] as string;
      const meta = bySymbol.get(symbol) as MockSymbol;
      const previous = prices.get(symbol) as number;

      // Random step plus a light pull back to the base price, so the walk stays near it.
      const step = (random() - 0.5) * 2 * meta.volatility;
      const pull = ((meta.basePrice - previous) / meta.basePrice) * 0.01;
      const price = Math.max(round(previous * (1 + step + pull), meta.decimals), 10 ** -meta.decimals);
      prices.set(symbol, price);

      return {
        symbol,
        name: meta.name,
        price,
        currency: meta.currency,
        change24h: round(((price - meta.basePrice) / meta.basePrice) * 100, 2),
        kind: 'stream',
        source: MOCK_SOURCE_ID,
        updatedAt: now(),
      };
    },
  };
}

export interface MockAdapterOptions extends MockOptions {
  /** Target message rate. Default 200 per second. */
  messagesPerSecond?: number;
  /** How often a batch is emitted. Default every 50 ms. */
  tickMs?: number;
}

/**
 * Stream adapter backed by the seeded generator. Emits batches on a timer at
 * roughly `messagesPerSecond`. Needs no network, so it runs in CI and in the
 * static public demo.
 */
export function createMockAdapter(options: MockAdapterOptions = {}): QuoteAdapter {
  const { messagesPerSecond = 200, tickMs = 50, ...generatorOptions } = options;
  const generator = createMockQuoteGenerator(generatorOptions);
  const known = new Set((generatorOptions.symbols ?? MOCK_SYMBOLS).map((s) => s.symbol));
  const perTick = (messagesPerSecond * tickMs) / 1000;

  return {
    id: MOCK_SOURCE_ID,
    kind: 'stream',
    subscribe(symbols, onQuotes) {
      // Nothing we can stream: don't start a timer.
      if (!symbols.some((s) => known.has(s))) return () => undefined;

      let carry = 0;
      const timer = setInterval(() => {
        carry += perTick;
        const count = Math.floor(carry);
        carry -= count;
        const batch: Quote[] = [];
        for (let i = 0; i < count; i++) {
          const quote = generator.next(symbols);
          if (quote) batch.push(quote);
        }
        if (batch.length > 0) onQuotes(batch);
      }, tickMs);

      return () => clearInterval(timer);
    },
  };
}
