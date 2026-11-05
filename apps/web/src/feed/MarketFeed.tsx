'use client';

import { useEffect } from 'react';
import { quoteActions } from '@/store/hooks';
import { startFeed } from './start-feed';

/**
 * Starts the price feed for the given symbols while mounted. Renders nothing.
 * Set NEXT_PUBLIC_WS_URL (e.g. ws://localhost:4000) to use the mock server
 * instead of the in-browser mock market.
 */
export function MarketFeed({ symbols }: { symbols: string[] }) {
  const key = symbols.join(',');

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    return startFeed({
      symbols: key.split(','),
      actions: quoteActions,
      ...(wsUrl ? { wsUrl } : {}),
    });
  }, [key]);

  return null;
}
