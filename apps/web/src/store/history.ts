import type { PricePoint, Quote } from '@nerkh/data';

export type Timeframe = '1m' | '5m' | '1h' | '1D';

export const TIMEFRAMES: Record<Timeframe, { ms: number; label: string }> = {
  '1m': { ms: 60_000, label: '1 minute' },
  '5m': { ms: 5 * 60_000, label: '5 minutes' },
  '1h': { ms: 3_600_000, label: '1 hour' },
  '1D': { ms: 86_400_000, label: '1 day' },
};

/** Two resolutions keep memory bounded: 1 s points for the last hour, 1 min points for a day. */
const TIERS = {
  fine: { stepMs: 1000, max: 3600 },
  coarse: { stepMs: 60_000, max: 1440 },
} as const;
type Tier = keyof typeof TIERS;

/** The chart never draws more than this many points, whatever the timeframe. */
export const MAX_RENDER_POINTS = 240;

/** Keep the last point per bucket. Assumes points are in time order. */
export function downsample(
  points: readonly PricePoint[],
  from: number,
  to: number,
  buckets: number,
): PricePoint[] {
  if (points.length <= buckets) return points.filter((pt) => pt.t >= from && pt.t <= to);
  const size = (to - from) / buckets;
  const out: PricePoint[] = [];
  let lastBucket = -1;
  for (const pt of points) {
    if (pt.t < from || pt.t > to) continue;
    const bucket = Math.min(buckets - 1, Math.floor((pt.t - from) / size));
    if (bucket === lastBucket) out[out.length - 1] = pt;
    else out.push(pt);
    lastBucket = bucket;
  }
  return out;
}

/**
 * Price history per symbol for the chart. Plain object (not React state):
 * live quotes are appended every frame, and the chart reads it a few times a
 * second, so appending never triggers renders.
 */
export class PriceHistory {
  private readonly tiers: Record<Tier, Map<string, PricePoint[]>> = { fine: new Map(), coarse: new Map() };

  /** Start a symbol from existing history (e.g. a mock backfill or a snapshot), oldest first. */
  seed(symbol: string, fine: readonly PricePoint[], coarse: readonly PricePoint[]): void {
    this.tiers.fine.set(symbol, fine.slice(-TIERS.fine.max));
    this.tiers.coarse.set(symbol, coarse.slice(-TIERS.coarse.max));
  }

  has(symbol: string): boolean {
    return this.tiers.fine.has(symbol);
  }

  append(quotes: readonly Quote[]): void {
    for (const q of quotes) {
      for (const tier of ['fine', 'coarse'] as const)
        this.push(tier, q.symbol, { t: q.updatedAt, p: q.price });
    }
  }

  private push(tier: Tier, symbol: string, point: PricePoint): void {
    const { stepMs, max } = TIERS[tier];
    let list = this.tiers[tier].get(symbol);
    if (!list) {
      list = [];
      this.tiers[tier].set(symbol, list);
    }
    const last = list.at(-1);
    if (last && point.t < last.t) return; // late quote: history only moves forward
    if (last && Math.floor(last.t / stepMs) === Math.floor(point.t / stepMs)) {
      list[list.length - 1] = point; // same bucket: keep the latest price
    } else {
      list.push(point);
      // Trim in chunks so we don't shift the array on every push.
      if (list.length > max * 1.25) list.splice(0, list.length - max);
    }
  }

  /** Points for the chart: inside the timeframe, at most MAX_RENDER_POINTS. */
  series(symbol: string, timeframe: Timeframe, now: number): PricePoint[] {
    const { ms } = TIMEFRAMES[timeframe];
    const tier: Tier = ms > TIERS.fine.max * TIERS.fine.stepMs ? 'coarse' : 'fine';
    const points = this.tiers[tier].get(symbol) ?? [];
    return downsample(points, now - ms, now, MAX_RENDER_POINTS);
  }

  clear(): void {
    this.tiers.fine.clear();
    this.tiers.coarse.clear();
  }
}

/** The app's shared history. */
export const priceHistory = new PriceHistory();

export interface SeriesSummary {
  first: number;
  last: number;
  min: number;
  max: number;
  changePct: number;
}

export function summarize(points: readonly PricePoint[]): SeriesSummary | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const { p } of points) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { first: first.p, last: last.p, min, max, changePct: ((last.p - first.p) / first.p) * 100 };
}
