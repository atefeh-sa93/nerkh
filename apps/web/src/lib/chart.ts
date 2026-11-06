import type { PricePoint } from '@nerkh/data';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { TIMEFRAMES, summarize, type Timeframe } from '@/store/history';
import { formatChange, formatPrice } from './format';

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 200;

export interface ChartGeometry {
  /** SVG path for the price line, in a CHART_WIDTH × CHART_HEIGHT box. */
  path: string;
  /** Last point as a percentage of the box, for the end dot drawn in HTML. */
  end: { xPct: number; yPct: number };
  /** Y positions (percent from top) for horizontal grid lines and their prices. */
  ticks: { yPct: number; price: number }[];
}

/** A jump in time this much larger than the usual spacing (and at least 5 s) counts as missing data. */
export function gapThreshold(points: readonly PricePoint[]): number {
  const steps: number[] = [];
  for (let i = 1; i < points.length; i++) steps.push((points[i]?.t ?? 0) - (points[i - 1]?.t ?? 0));
  steps.sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)] ?? 0;
  return Math.max(5000, median * 5);
}

/** Turns points into an SVG path; null when there is nothing to draw. */
export function chartGeometry(points: readonly PricePoint[]): ChartGeometry | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const { p } of points) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  // Pad the range so the line doesn't touch the edges; a flat line sits in the middle.
  const pad = max === min ? Math.abs(max) * 0.001 || 1 : (max - min) * 0.1;
  const y = scaleLinear()
    .domain([min - pad, max + pad])
    .range([CHART_HEIGHT, 0]);
  const x = scaleLinear()
    .domain([first.t, last.t === first.t ? first.t + 1 : last.t])
    .range([0, CHART_WIDTH]);

  // Leave a visible gap where data is missing (paused, disconnected) instead
  // of drawing a straight line that pretends the price moved smoothly.
  const gapMs = gapThreshold(points);
  const withGaps: (PricePoint | null)[] = [];
  points.forEach((pt, i) => {
    const prev = points[i - 1];
    if (prev && pt.t - prev.t > gapMs) withGaps.push(null);
    withGaps.push(pt);
  });

  const path =
    line<PricePoint | null>()
      .defined((pt) => pt !== null)
      .x((pt) => x((pt as PricePoint).t))
      .y((pt) => y((pt as PricePoint).p))(withGaps) ?? '';

  return {
    path,
    end: { xPct: (x(last.t) / CHART_WIDTH) * 100, yPct: (y(last.p) / CHART_HEIGHT) * 100 },
    ticks: y.ticks(3).map((price) => ({ price, yPct: (y(price) / CHART_HEIGHT) * 100 })),
  };
}

/** Text alternative for screen readers, e.g. "BTC-EUR over the last 5 minutes: up 0.34%, from … to …". */
export function describeSeries(symbol: string, timeframe: Timeframe, points: readonly PricePoint[]): string {
  const s = summarize(points);
  if (!s) return `${symbol}: no price data for the last ${TIMEFRAMES[timeframe].label} yet.`;
  const trend = s.changePct > 0 ? 'up' : s.changePct < 0 ? 'down' : 'unchanged';
  return (
    `${symbol} over the last ${TIMEFRAMES[timeframe].label}: ${trend} ${formatChange(s.changePct)}, ` +
    `from ${formatPrice(s.first)} to ${formatPrice(s.last)}; ` +
    `low ${formatPrice(s.min)}, high ${formatPrice(s.max)}.`
  );
}

/** Axis time label: seconds for short ranges; weekday + minutes for a day (both ends share a clock time). */
export function formatAxisTime(t: number, timeframe: Timeframe): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeframe === '1D' ? { weekday: 'short' } : { second: '2-digit' }),
    hour12: false,
  }).format(t);
}
