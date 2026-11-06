import { describe, expect, it } from 'vitest';
import { chartGeometry, describeSeries } from './chart';

const pts = [
  { t: 0, p: 100 },
  { t: 50, p: 90 },
  { t: 100, p: 110 },
];

describe('chartGeometry', () => {
  it('draws a path across the full width, time left to right', () => {
    const g = chartGeometry(pts);
    expect(g?.path.startsWith('M0,')).toBe(true);
    expect(g?.path).toContain('L800,');
    expect(g?.end.xPct).toBe(100);
  });

  it('puts higher prices higher up (smaller y) and keeps the line off the edges', () => {
    const g = chartGeometry(pts);
    expect(g?.end.yPct).toBeGreaterThan(0); // padded: the max is not glued to the top
    expect(g?.end.yPct).toBeLessThan(50);
    const ticks = g?.ticks ?? [];
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++) {
      // ticks ascend in price, so they descend on screen
      expect((ticks[i]?.yPct ?? 0) < (ticks[i - 1]?.yPct ?? 0)).toBe(true);
    }
  });

  it('breaks the line where data is missing (e.g. while paused)', () => {
    const steady = Array.from({ length: 10 }, (_, i) => ({ t: i * 1000, p: 100 + i }));
    const resumed = Array.from({ length: 10 }, (_, i) => ({ t: 60_000 + i * 1000, p: 120 + i }));
    const path = chartGeometry([...steady, ...resumed])?.path ?? '';
    expect(path.match(/M/g)).toHaveLength(2); // two separate segments
    expect(chartGeometry(steady)?.path.match(/M/g)).toHaveLength(1);
  });

  it('handles a single point or a flat line without dividing by zero', () => {
    expect(chartGeometry([{ t: 5, p: 42 }])?.end.yPct).toBeCloseTo(50, 5);
    expect(chartGeometry([])).toBeNull();
  });
});

describe('describeSeries', () => {
  it('summarises direction, change and range', () => {
    expect(describeSeries('BTC-EUR', '5m', pts)).toBe(
      'BTC-EUR over the last 5 minutes: up +10.00%, from 100.00 to 110.00; low 90.00, high 110.00.',
    );
  });

  it('says when there is no data yet', () => {
    expect(describeSeries('BTC-EUR', '1h', [])).toBe('BTC-EUR: no price data for the last 1 hour yet.');
  });
});
