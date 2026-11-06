'use client';

import { useStore } from 'zustand';
import { formatAge, freshnessOf } from '@/lib/format';
import { lastSecond, rateBars } from '@/lib/status';
import { useNow } from '@/lib/use-now';
import { feedStore, RATE_WINDOW } from '@/store/feed';
import { useConnection } from '@/store/hooks';

const BAR_W = 4;
const GAP = 2;
const CHART_H = 56;

/**
 * Where the data comes from, how fresh it is, and how the stream behaved over
 * the last minute. Only sources that are really in use are listed.
 */
export function SourcesRail() {
  const source = useStore(feedStore, (s) => s.source);
  const seconds = useStore(feedStore, (s) => s.seconds);
  const lastQuoteAt = useStore(feedStore, (s) => s.lastQuoteAt);
  const reconnects = useStore(feedStore, (s) => s.reconnects);
  const connection = useConnection();
  const now = useNow();

  const current = lastSecond(seconds);
  const freshness =
    lastQuoteAt !== null && now !== 0 && source
      ? freshnessOf({ kind: source.kind, updatedAt: lastQuoteAt }, now)
      : null;
  const paused = connection.status === 'paused';
  const stale = freshness?.state === 'stale';
  const tag = stale ? 'STALE' : paused ? 'PAUSED' : source?.kind === 'periodic' ? 'PERIODIC' : 'STREAM';
  const bars = rateBars(seconds, RATE_WINDOW, CHART_H);
  const down = seconds.filter((s) => s.state === 'down').length;

  return (
    <aside aria-label="Data sources" className="flex flex-col gap-5 bg-rail p-5">
      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 font-mono text-[11px] font-semibold tracking-widest text-muted">DATA SOURCES</h2>
        {source ? (
          <div
            className={`flex flex-col gap-2 rounded-[10px] bg-surface p-3 ${stale ? 'outline-1 outline-stale outline-dashed' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold" title={source.label}>
                {source.label}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  stale ? 'bg-stale-bg text-stale' : paused ? 'bg-border text-text' : 'bg-live/15 text-live'
                }`}
              >
                <span aria-hidden="true">{stale ? '◷ ' : paused ? '❚❚ ' : '● '}</span>
                {tag}
              </span>
            </div>
            <div className="font-mono text-xs text-muted">
              {source.transport} · {current.messages} msg/s
              {freshness ? ` · ${formatAge(freshness.ageMs)}` : ''}
            </div>
            <div className="h-1 rounded-sm bg-border" aria-hidden="true">
              <div
                className={`h-1 rounded-sm ${stale ? 'bg-stale' : 'bg-live'}`}
                style={{ width: `${Math.round((freshness?.level ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">No source yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="m-0 font-mono text-[11px] font-semibold tracking-widest text-muted">
          STREAM · LAST 60s
        </h2>
        <svg
          viewBox={`0 0 ${RATE_WINDOW * (BAR_W + GAP)} ${CHART_H}`}
          className="h-14 w-full"
          role="img"
          aria-label={`Messages per second over the last minute. Now ${current.messages} per second.${
            down ? ` ${down} seconds disconnected.` : ''
          }`}
        >
          {bars.map((b) => (
            <rect
              key={b.x}
              x={b.x * (BAR_W + GAP)}
              y={CHART_H - b.height}
              width={BAR_W}
              height={b.height}
              className={b.state === 'down' ? 'fill-stale' : b.state === 'paused' ? 'fill-border' : 'fill-up'}
            />
          ))}
        </svg>
        <div className="flex justify-between font-mono text-[11px] text-muted">
          <span>{current.updates} store updates/s</span>
          <span>{reconnects === 1 ? '1 reconnect' : `${reconnects} reconnects`}</span>
        </div>
      </section>

      <p className="m-0 text-xs leading-relaxed text-muted">
        {current.messages} quotes a second are merged into at most one store update per frame.
      </p>
    </aside>
  );
}
