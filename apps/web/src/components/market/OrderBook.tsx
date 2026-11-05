'use client';

import type { BookLevel } from '@nerkh/data';
import { formatPrice } from '@/lib/format';
import { useSelectedSymbol } from '@/store/hooks';
import { useOrderBook } from '@/store/use-order-book';

function formatSize(size: number): string {
  return size.toFixed(3);
}

function Side({ levels, side }: { levels: BookLevel[]; side: 'ask' | 'bid' }) {
  const ask = side === 'ask';
  return (
    <table className="w-full border-collapse font-mono text-xs tabular-nums">
      <caption className="sr-only">
        {ask
          ? 'Sell orders (asks), lowest price nearest the middle'
          : 'Buy orders (bids), highest price nearest the middle'}
      </caption>
      <tbody>
        {levels.map((level) => (
          <tr key={level.price} className="relative">
            <td className="relative py-[3px] ps-4">
              {/* Depth bar: share of this side's volume up to this level. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 end-0 ${ask ? 'bg-down/15' : 'bg-up/15'}`}
                style={{ width: `${Math.round(level.depth * 100)}%` }}
              />
              <span className={`relative ${ask ? 'text-down' : 'text-up'}`}>{formatPrice(level.price)}</span>
            </td>
            <td className="relative py-[3px] pe-4 text-end">{formatSize(level.size)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Order book for the selected symbol: asks above (best at the bottom), the
 * spread in the middle, bids below (best at the top). Mock data.
 */
export function OrderBook() {
  const symbol = useSelectedSymbol();
  const book = useOrderBook(symbol);

  return (
    <section
      aria-label={symbol ? `Order book for ${symbol}` : 'Order book'}
      className="flex min-w-0 flex-col"
    >
      <div className="flex flex-wrap justify-between gap-x-3 px-4 py-2.5 font-mono text-[11px] font-semibold tracking-wider text-muted">
        <h2 className="m-0 text-[11px] font-semibold whitespace-nowrap">
          ORDER BOOK{symbol ? ` · ${symbol}` : ''}
        </h2>
        {book && (
          <span className="whitespace-nowrap">
            spread {formatPrice(book.spread, book.asks[0]?.price ?? book.spread)}
          </span>
        )}
      </div>
      <div aria-hidden="true" className="flex justify-between px-4 pb-1 text-[11px] text-muted">
        <span>Price</span>
        <span>Size</span>
      </div>
      {book ? (
        <>
          <Side levels={[...book.asks].reverse()} side="ask" />
          <div className="my-1 flex items-baseline justify-between border-y border-border px-4 py-2 font-mono tabular-nums">
            <span className="text-[15px] font-semibold">
              {formatPrice(((book.asks[0]?.price ?? 0) + (book.bids[0]?.price ?? 0)) / 2)}
            </span>
            <span className="text-[11px] text-muted">mid</span>
          </div>
          <Side levels={book.bids} side="bid" />
        </>
      ) : (
        <p className="px-4 py-6 text-sm text-muted">Waiting for prices…</p>
      )}
    </section>
  );
}
