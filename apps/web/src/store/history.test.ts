import type { PricePoint, Quote } from '@nerkh/data';
import { describe, expect, it } from 'vitest';
import { downsample, MAX_RENDER_POINTS, PriceHistory, summarize } from './history';

function q(price: number, updatedAt: number, symbol = 'BTC-EUR'): Quote {
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

describe('PriceHistory', () => {
  it('keeps one point per second (the latest price in that second)', () => {
    const h = new PriceHistory();
    h.append([q(1, 10_000), q(2, 10_400), q(3, 10_900), q(4, 11_100)]);
    expect(h.series('BTC-EUR', '1m', 11_100)).toEqual([
      { t: 10_900, p: 3 },
      { t: 11_100, p: 4 },
    ]);
  });

  it('ignores quotes older than the last point', () => {
    const h = new PriceHistory();
    h.append([q(5, 20_000), q(1, 15_000)]);
    expect(h.series('BTC-EUR', '1m', 20_000)).toEqual([{ t: 20_000, p: 5 }]);
  });

  it('returns only points inside the timeframe', () => {
    const h = new PriceHistory();
    const now = 10 * 60_000;
    h.append([q(1, now - 6 * 60_000), q(2, now - 2 * 60_000), q(3, now)]);
    expect(h.series('BTC-EUR', '5m', now).map((pt) => pt.p)).toEqual([2, 3]);
    expect(h.series('BTC-EUR', '1h', now).map((pt) => pt.p)).toEqual([1, 2, 3]);
  });

  it('uses minute points for a day and second points for an hour', () => {
    const h = new PriceHistory();
    const now = 2 * 86_400_000;
    const fine: PricePoint[] = Array.from({ length: 3600 }, (_, i) => ({ t: now - (3599 - i) * 1000, p: 1 }));
    const coarse: PricePoint[] = Array.from({ length: 1440 }, (_, i) => ({
      t: now - (1439 - i) * 60_000,
      p: 2,
    }));
    h.seed('BTC-EUR', fine, coarse);
    expect(h.series('BTC-EUR', '1h', now).every((pt) => pt.p === 1)).toBe(true);
    expect(h.series('BTC-EUR', '1D', now).every((pt) => pt.p === 2)).toBe(true);
  });

  it('never returns more than MAX_RENDER_POINTS, and keeps the newest point', () => {
    const h = new PriceHistory();
    const now = 4_000_000;
    h.append(Array.from({ length: 3600 }, (_, i) => q(i, now - (3599 - i) * 1000)));
    const series = h.series('BTC-EUR', '1h', now);
    expect(series.length).toBeLessThanOrEqual(MAX_RENDER_POINTS);
    expect(series.at(-1)).toEqual({ t: now, p: 3599 });
  });

  it('memory stays bounded however long it runs', () => {
    const h = new PriceHistory();
    for (let s = 0; s < 3 * 3600; s++) h.append([q(s, s * 1000)]);
    const internal = (h as unknown as { tiers: { fine: Map<string, unknown[]> } }).tiers.fine.get('BTC-EUR');
    expect(internal?.length).toBeLessThanOrEqual(3600 * 1.25);
  });
});

describe('downsample', () => {
  it('returns the input when it already fits', () => {
    const pts = [
      { t: 1, p: 1 },
      { t: 2, p: 2 },
    ];
    expect(downsample(pts, 0, 10, 5)).toEqual(pts);
  });

  it('keeps the last point of each bucket', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ t: i, p: i }));
    expect(downsample(pts, 0, 10, 2).map((pt) => pt.p)).toEqual([4, 9]);
  });
});

describe('summarize', () => {
  it('gives first, last, range and change', () => {
    expect(
      summarize([
        { t: 1, p: 100 },
        { t: 2, p: 90 },
        { t: 3, p: 110 },
      ]),
    ).toEqual({ first: 100, last: 110, min: 90, max: 110, changePct: 10 });
    expect(summarize([])).toBeNull();
  });
});
