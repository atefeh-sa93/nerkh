'use client';

import { memo } from 'react';
import { formatAge, formatChange, formatPrice, freshnessOf } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { quoteActions, useIsSelected, useQuoteEntry } from '@/store/hooks';

/** Must match the flash animation length in globals.css. */
const FLASH_MS = 700;

/**
 * One table row. Subscribes to its own symbol only, so a price change in
 * another row never re-renders this one.
 */
export const MarketRow = memo(function MarketRow({ symbol }: { symbol: string }) {
  const entry = useQuoteEntry(symbol);
  const selected = useIsSelected(symbol);
  const now = useNow();
  if (!entry) return null;

  const { quote, direction, changedAt } = entry;
  const change = quote.change24h;
  const changeUp = change !== null && change > 0;
  const changeDown = change !== null && change < 0;
  const freshness = now === 0 ? null : freshnessOf(quote, now);
  const stale = freshness?.state === 'stale';

  return (
    <tr
      data-selected={selected || undefined}
      className={`border-t border-border ${selected ? 'bg-up/10 shadow-[inset_3px_0_0_var(--nk-up)]' : ''} ${
        stale ? 'bg-stale-bg/40' : ''
      }`}
    >
      <th scope="row" className="p-0 text-start font-normal">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => quoteActions.select(symbol)}
          className="flex min-h-11 w-full flex-col items-start justify-center px-2 py-1.5 text-start"
        >
          <span className="font-semibold whitespace-nowrap">{quote.symbol}</span>
          <span className="font-mono text-[11px] whitespace-nowrap text-muted">{quote.source}</span>
        </button>
      </th>

      <td className="px-2 text-end font-mono whitespace-nowrap tabular-nums">
        {/*
          Remounting restarts the flash. At ~20 updates a second per symbol a
          flash per update would never stop, so the key changes at most once
          per flash length (700 ms).
        */}
        <span
          key={Math.floor(changedAt / FLASH_MS)}
          className={`rounded px-1 ${direction === 'up' ? 'animate-flash-up' : ''} ${
            direction === 'down' ? 'animate-flash-down' : ''
          }`}
        >
          {formatPrice(quote.price)}
        </span>
      </td>

      <td
        className={`px-2 text-end font-mono whitespace-nowrap tabular-nums ${changeUp ? 'text-up' : changeDown ? 'text-down' : 'text-text'}`}
      >
        <span aria-hidden="true">{changeUp ? '▲ ' : changeDown ? '▼ ' : ''}</span>
        {formatChange(change)}
      </td>

      <td className="px-2 ps-5 whitespace-nowrap">
        {freshness && (
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-18 rounded-full bg-border" aria-hidden="true">
              <div
                className={`h-1.5 rounded-full ${stale ? 'bg-stale' : freshness.state === 'live' ? 'bg-live' : 'bg-muted'}`}
                style={{ width: `${Math.round(freshness.level * 100)}%` }}
              />
            </div>
            {stale ? (
              <span className="rounded bg-stale-bg px-1.5 font-mono text-xs font-semibold text-stale">
                <span aria-hidden="true">◷ </span>
                {formatAge(freshness.ageMs)} stale
              </span>
            ) : (
              <span className="font-mono text-xs text-muted">{formatAge(freshness.ageMs)}</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
});
