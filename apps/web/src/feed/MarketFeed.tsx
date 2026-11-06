'use client';

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { feedStore, rateCounter, type SecondState } from '@/store/feed';
import { priceHistory } from '@/store/history';
import { quoteActions } from '@/store/hooks';
import { quotesStore } from '@/store/quotes';
import { startFeed } from './start-feed';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

/**
 * Starts the price feed for the given symbols while mounted and not paused.
 * Renders nothing. Set NEXT_PUBLIC_WS_URL (e.g. ws://localhost:4000) to use
 * the mock server instead of the in-browser mock market.
 */
export function MarketFeed({ symbols }: { symbols: string[] }) {
  const key = symbols.join(',');
  const paused = useStore(feedStore, (s) => s.paused);

  // The data source itself. Pausing tears it down; resuming starts it again.
  useEffect(() => {
    feedStore
      .getState()
      .setSource(
        WS_URL
          ? { id: 'ws-server', label: WS_URL, kind: 'stream', transport: 'WebSocket' }
          : { id: 'mock-stream', label: 'mock-stream', kind: 'stream', transport: 'in-browser' },
      );
    if (paused) {
      quoteActions.setConnection({ status: 'paused', attempt: 0 });
      return;
    }
    return startFeed({
      symbols: key.split(','),
      actions: quoteActions,
      history: priceHistory,
      onReceived: (quotes) => rateCounter.add(quotes),
      onReconnected: () => feedStore.getState().noteReconnect(),
      ...(WS_URL ? { wsUrl: WS_URL } : {}),
    });
  }, [key, paused]);

  // A 1-second meter for the sources rail: messages in, store updates out.
  useEffect(() => {
    let lastBatches = quotesStore.getState().batches;
    const id = setInterval(() => {
      const { messages, newest } = rateCounter.take();
      const batches = quotesStore.getState().batches;
      const status = quotesStore.getState().connection.status;
      const state: SecondState = status === 'paused' ? 'paused' : status === 'connected' ? 'ok' : 'down';
      feedStore.getState().recordSecond({ messages, updates: batches - lastBatches, state }, newest);
      lastBatches = batches;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
