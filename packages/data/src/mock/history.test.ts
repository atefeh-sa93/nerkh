import { describe, expect, it } from 'vitest';
import { createMockHistory } from './history.ts';
import { MOCK_SYMBOLS } from './symbols.ts';

const end = 1_793_866_630_000;

describe('createMockHistory', () => {
  it('is repeatable for the same seed and differs between symbols', () => {
    const a = createMockHistory('BTC-EUR', { end, stepMs: 60_000, points: 100 });
    expect(createMockHistory('BTC-EUR', { end, stepMs: 60_000, points: 100 })).toEqual(a);
    expect(createMockHistory('ETH-EUR', { end, stepMs: 60_000, points: 100 }).map((x) => x.p)).not.toEqual(
      a.map((x) => x.p),
    );
  });

  it('is evenly spaced, oldest first, and ends at the base price at `end`', () => {
    const series = createMockHistory('USD-IRT', { end, stepMs: 1000, points: 60 });
    expect(series).toHaveLength(60);
    expect(series.at(-1)).toEqual({ t: end, p: 824_500 });
    expect(series[0]?.t).toBe(end - 59_000);
    for (let i = 1; i < series.length; i++) expect((series[i]?.t ?? 0) - (series[i - 1]?.t ?? 0)).toBe(1000);
  });

  it('stays positive, rounded and near the base price for a whole day', () => {
    for (const s of MOCK_SYMBOLS) {
      for (const { p } of createMockHistory(s.symbol, { end, stepMs: 60_000, points: 1440 })) {
        expect(p).toBeGreaterThan(0);
        expect(Math.round(p * 10 ** s.decimals) / 10 ** s.decimals).toBe(p);
        expect(Math.abs(p - s.basePrice) / s.basePrice).toBeLessThan(0.25);
      }
    }
  });

  it('returns nothing for unknown symbols or zero points', () => {
    expect(createMockHistory('NOPE-EUR', { end, stepMs: 1000, points: 10 })).toEqual([]);
    expect(createMockHistory('BTC-EUR', { end, stepMs: 1000, points: 0 })).toEqual([]);
  });
});
