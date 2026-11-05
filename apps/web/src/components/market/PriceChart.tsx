'use client';

import { useState } from 'react';
import { CHART_HEIGHT, CHART_WIDTH, chartGeometry, describeSeries, formatAxisTime } from '@/lib/chart';
import { formatAge, formatChange, formatPrice, freshnessOf } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { TIMEFRAMES, type Timeframe } from '@/store/history';
import { useSelectedEntry } from '@/store/hooks';
import { useSeries } from '@/store/use-series';

const TIMEFRAME_KEYS = Object.keys(TIMEFRAMES) as Timeframe[];

/** Price chart for the selected symbol. Follows the selection; redraws twice a second. */
export function PriceChart() {
  const entry = useSelectedEntry();
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const symbol = entry?.quote.symbol ?? null;
  const points = useSeries(symbol, timeframe);
  const now = useNow();

  const geometry = chartGeometry(points);
  const quote = entry?.quote;
  const change = quote?.change24h ?? null;
  const freshness = quote && now !== 0 ? freshnessOf(quote, now) : null;
  const first = points[0];
  const last = points.at(-1);

  return (
    <section aria-label="Price chart" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div className="flex flex-col gap-1">
          {freshness && (
            <span
              className={`flex items-center gap-2 font-mono text-xs font-semibold ${
                freshness.state === 'stale'
                  ? 'text-stale'
                  : freshness.state === 'live'
                    ? 'text-live'
                    : 'text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${freshness.state === 'live' ? 'bg-live' : 'bg-stale'}`}
              />
              {freshness.state.toUpperCase()} · {formatAge(freshness.ageMs)} ago · {quote?.source}
            </span>
          )}
          <h2 className="m-0 text-base font-medium text-muted">
            {quote ? `${quote.symbol} · ${quote.name.en}` : 'Waiting for prices…'}
          </h2>
        </div>
        {quote && (
          <>
            <span className="font-mono text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatPrice(quote.price)}
            </span>
            <span
              className={`font-mono text-lg font-semibold ${change !== null && change > 0 ? 'text-up' : change !== null && change < 0 ? 'text-down' : ''}`}
            >
              <span aria-hidden="true">
                {change !== null && change > 0 ? '▲ ' : change !== null && change < 0 ? '▼ ' : ''}
              </span>
              {formatChange(change)}
            </span>
          </>
        )}
        <div role="group" aria-label="Timeframe" className="ms-auto flex gap-1">
          {TIMEFRAME_KEYS.map((tf) => (
            <button
              key={tf}
              type="button"
              aria-pressed={tf === timeframe}
              aria-label={`Last ${TIMEFRAMES[tf].label}`}
              onClick={() => setTimeframe(tf)}
              className={`min-h-11 min-w-11 rounded-lg border font-mono text-[13px] ${
                tf === timeframe
                  ? 'border-muted bg-surface font-semibold text-text'
                  : 'border-border text-muted'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Time always runs left to right, also on the RTL page. */}
        <div dir="ltr" className="relative h-[200px] border-b border-border">
          {geometry?.ticks.map((tick) => (
            <div
              key={tick.price}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: `${tick.yPct}%` }}
            >
              <span className="absolute end-0 -translate-y-full bg-bg ps-1 font-mono text-[11px] text-muted">
                {formatPrice(tick.price)}
              </span>
            </div>
          ))}
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            role="img"
            aria-label={symbol ? describeSeries(symbol, timeframe, points) : 'No symbol selected'}
          >
            {geometry && (
              <path
                d={geometry.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            )}
          </svg>
          {geometry && (
            <span
              aria-hidden="true"
              className="absolute size-2.5 -translate-1/2 rounded-full bg-up"
              style={{ left: `${geometry.end.xPct}%`, top: `${geometry.end.yPct}%` }}
            />
          )}
        </div>
        {first && last && (
          <div
            dir="ltr"
            aria-hidden="true"
            className="flex justify-between pt-1 font-mono text-[11px] text-muted"
          >
            <span>{formatAxisTime(first.t, timeframe)}</span>
            <span>{formatAxisTime(last.t, timeframe)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
