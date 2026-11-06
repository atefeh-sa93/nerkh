'use client';

import { useEffect, useState } from 'react';
import { formatChange, formatPrice } from '@/lib/format';
import { quotesStore } from '@/store/quotes';

/** How often a screen reader hears the selected price. Prices change ~20 times a second. */
export const ANNOUNCE_EVERY_MS = 10_000;

/**
 * Polite live region for the selected symbol only, at most every 10 seconds.
 * Announcing every update (or every row) would make a screen reader unusable.
 */
export function PriceAnnouncer() {
  const [text, setText] = useState('');

  useEffect(() => {
    let last = '';
    const id = setInterval(() => {
      const { selected, entries } = quotesStore.getState();
      const quote = selected ? entries[selected]?.quote : undefined;
      if (!quote) return;
      const next = `${quote.symbol} ${formatPrice(quote.price)}, ${formatChange(quote.change24h)} today`;
      if (next !== last) {
        last = next;
        setText(next);
      }
    }, ANNOUNCE_EVERY_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
}
