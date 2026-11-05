'use client';

import type { PricePoint } from '@nerkh/data';
import { useCallback, useSyncExternalStore } from 'react';
import { priceHistory, type Timeframe } from './history';

/** How often the chart redraws. Prices arrive every frame; the chart doesn't need to. */
export const CHART_REFRESH_MS = 500;

const EMPTY: PricePoint[] = [];
const cache = new Map<string, { key: number; points: PricePoint[] }>();

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, CHART_REFRESH_MS);
  return () => clearInterval(id);
}

/**
 * The selected symbol's series for a timeframe, re-read at most every
 * CHART_REFRESH_MS. The snapshot is cached per refresh slot, so React sees
 * the same array until the next slot.
 */
export function useSeries(symbol: string | null, timeframe: Timeframe): PricePoint[] {
  const getSnapshot = useCallback(() => {
    if (!symbol) return EMPTY;
    const slot = Math.floor(Date.now() / CHART_REFRESH_MS);
    const id = `${symbol}|${timeframe}`;
    const hit = cache.get(id);
    if (hit && hit.key === slot) return hit.points;
    const points = priceHistory.series(symbol, timeframe, slot * CHART_REFRESH_MS + CHART_REFRESH_MS);
    cache.set(id, { key: slot, points });
    return points;
  }, [symbol, timeframe]);

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
