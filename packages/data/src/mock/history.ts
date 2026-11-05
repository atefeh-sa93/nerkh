import { createSeededRandom } from './random.ts';
import { MOCK_SYMBOLS, type MockSymbol } from './symbols.ts';

export interface PricePoint {
  /** Epoch milliseconds. */
  t: number;
  /** Price, in the symbol's stored unit (rial for Iran). */
  p: number;
}

export interface MockHistoryOptions {
  /** Time of the last point; the series ends here at the symbol's base price. */
  end: number;
  /** Spacing between points, e.g. 1000 (seconds) or 86_400_000 (days). */
  stepMs: number;
  /** Number of points, oldest first. */
  points: number;
  seed?: number;
  symbols?: readonly MockSymbol[];
}

function symbolSeed(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Seeded, illustrative price history that ends at the symbol's base price, so
 * live mock quotes continue from it without a jump. Walks backwards from the
 * end, with volatility scaled to the step size. Not real market data.
 */
export function createMockHistory(symbol: string, options: MockHistoryOptions): PricePoint[] {
  const { end, stepMs, points, seed = 42, symbols = MOCK_SYMBOLS } = options;
  const meta = symbols.find((s) => s.symbol === symbol);
  if (!meta || points <= 0) return [];

  const random = createSeededRandom(seed ^ symbolSeed(symbol) ^ stepMs);
  // Match the live stream: ~20 messages a second per symbol, each moving up to
  // ±volatility, spread ≈ 2.5 × volatility per second; grows with sqrt(time).
  // Capped so a day of minute steps moves a few percent; daily steps may move more.
  const maxStepVol = stepMs >= 3_600_000 ? 0.015 : 0.004;
  const stepVol = Math.min(maxStepVol, meta.volatility * 2.5 * Math.sqrt(stepMs / 1000));
  const factor = 10 ** meta.decimals;
  const series: PricePoint[] = new Array(points);
  let price = meta.basePrice;

  for (let i = points - 1; i >= 0; i--) {
    series[i] = { t: end - (points - 1 - i) * stepMs, p: Math.round(price * factor) / factor };
    const pull = ((meta.basePrice - price) / meta.basePrice) * 0.02;
    price = Math.max(price * (1 + (random() - 0.5) * 2 * stepVol + pull), 1 / factor);
  }
  return series;
}
