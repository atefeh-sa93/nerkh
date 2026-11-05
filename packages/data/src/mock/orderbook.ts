import { createSeededRandom } from './random.ts';
import { MOCK_SYMBOLS, type MockSymbol } from './symbols.ts';

export interface BookLevel {
  price: number;
  size: number;
  /** Running total from the best price outward, 0–1 of the side's total. Drives the depth bar. */
  depth: number;
}

export interface OrderBook {
  symbol: string;
  /** Sell orders, best (lowest) first. */
  asks: BookLevel[];
  /** Buy orders, best (highest) first. */
  bids: BookLevel[];
  /** Best ask − best bid. */
  spread: number;
}

export interface MockOrderBookOptions {
  /** Price the book is centred on (usually the latest quote). */
  mid: number;
  /** Levels per side. Default 7. */
  levels?: number;
  /** Same seed, same book. Change it over time to animate sizes. */
  seed?: number;
  symbols?: readonly MockSymbol[];
}

function withDepth(levels: { price: number; size: number }[]): BookLevel[] {
  const total = levels.reduce((sum, l) => sum + l.size, 0) || 1;
  let running = 0;
  return levels.map((l) => {
    running += l.size;
    return { ...l, depth: running / total };
  });
}

/**
 * Illustrative order book around `mid`: tick-aligned prices, a spread of about
 * two basis points (at least one tick), seeded sizes. For the mock stream only;
 * a real source would send its own book.
 */
export function createMockOrderBook(symbol: string, options: MockOrderBookOptions): OrderBook | null {
  const { mid, levels = 7, seed = 1, symbols = MOCK_SYMBOLS } = options;
  const meta = symbols.find((s) => s.symbol === symbol);
  if (!meta || !(mid > 0) || levels <= 0) return null;

  const tick = 10 ** -meta.decimals;
  const round = (p: number) => Math.round(p / tick) * tick;
  const fix = (p: number) => Number(p.toFixed(meta.decimals));
  const halfSpread = Math.max(tick, round(mid * 0.0001));
  const step = Math.max(tick, round(mid * 0.00002));
  const random = createSeededRandom(seed);
  const size = () => Number((0.05 + random() ** 2 * 2).toFixed(3));

  const bestAsk = fix(round(mid) + halfSpread);
  const bestBid = fix(round(mid) - halfSpread);
  const asks = Array.from({ length: levels }, (_, i) => ({ price: fix(bestAsk + i * step), size: size() }));
  const bids = Array.from({ length: levels }, (_, i) => ({ price: fix(bestBid - i * step), size: size() }));

  return {
    symbol,
    asks: withDepth(asks),
    bids: withDepth(bids).filter((l) => l.price > 0),
    spread: fix(bestAsk - bestBid),
  };
}
