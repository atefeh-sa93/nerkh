'use client';

import { useSymbols } from '@/store/hooks';
import { MarketRow } from './MarketRow';

/**
 * Live market table. The table itself only re-renders when a new symbol
 * appears; price changes re-render just the affected row.
 */
export function MarketTable() {
  const symbols = useSymbols();

  return (
    <section aria-label="Markets" className="min-w-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            All symbols with price, 24-hour change and data freshness. Select a symbol to show its chart.
          </caption>
          <thead>
            <tr className="font-mono text-[11px] tracking-wider text-muted">
              <th scope="col" className="px-2 py-2.5 text-start font-medium">
                SYMBOL
              </th>
              <th scope="col" className="px-2 py-2.5 text-end font-medium">
                PRICE
              </th>
              <th scope="col" className="px-2 py-2.5 text-end font-medium">
                24H
              </th>
              <th scope="col" className="px-2 py-2.5 ps-5 text-start font-medium">
                FRESHNESS
              </th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((symbol) => (
              <MarketRow key={symbol} symbol={symbol} />
            ))}
          </tbody>
        </table>
        {symbols.length === 0 && <p className="px-2 py-6 text-sm text-muted">Waiting for prices…</p>}
      </div>
    </section>
  );
}
