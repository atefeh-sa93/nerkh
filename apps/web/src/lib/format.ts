import type { Quote, QuoteKind } from '@nerkh/data';

const MINUS = '−'; // typographic minus, same width as plus

/** Decimal places that suit the size of the number: 1.0842 vs 63,412.50. */
function decimalsFor(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 10) return 2;
  return 4;
}

const priceFormatters = new Map<number, Intl.NumberFormat>();

/**
 * Price with grouping and magnitude-based decimals, e.g. 63,412.50 or 1.0842.
 * Pass `scale` to format a small amount (a spread) with the decimals of the price it belongs to.
 */
export function formatPrice(price: number, scale: number = price): string {
  const decimals = decimalsFor(scale);
  let formatter = priceFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    priceFormatters.set(decimals, formatter);
  }
  return formatter.format(price);
}

/** Percent change with an explicit sign: +2.31%, −3.48%, 0.00%; — when unknown. */
export function formatChange(percent: number | null): string {
  if (percent === null) return '—';
  const abs = Math.abs(percent).toFixed(2);
  if (abs === '0.00') return '0.00%';
  return `${percent > 0 ? '+' : MINUS}${abs}%`;
}

/** Short age: 0.4s, 12s, 6m, 2h. Negative ages (clock skew) count as 0. */
export function formatAge(ms: number): string {
  const age = Math.max(0, ms);
  if (age < 10_000) return `${(age / 1000).toFixed(1)}s`;
  if (age < 60_000) return `${Math.floor(age / 1000)}s`;
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m`;
  return `${Math.floor(age / 3_600_000)}h`;
}

/**
 * When data counts as stale. Streams update many times a second, so 30 s of
 * silence is already suspicious; periodic sources update every 15 minutes,
 * so they get 20 minutes. (Configurable thresholds come with ADR-004, #28.)
 */
export const STALE_AFTER_MS: Record<QuoteKind, number> = {
  stream: 30_000,
  periodic: 20 * 60_000,
};

export type FreshnessState = 'live' | 'periodic' | 'stale';

export interface Freshness {
  state: FreshnessState;
  /** 1 = just updated, 0 = at or past the stale threshold. Drives the bar width. */
  level: number;
  ageMs: number;
}

/** A stream is "live" until stale; a periodic quote is never called live. */
export function freshnessOf(quote: Pick<Quote, 'kind' | 'updatedAt'>, now: number): Freshness {
  const ageMs = Math.max(0, now - quote.updatedAt);
  const limit = STALE_AFTER_MS[quote.kind];
  const level = Math.max(0, Math.min(1, 1 - ageMs / limit));
  if (ageMs >= limit) return { state: 'stale', level: 0, ageMs };
  return { state: quote.kind === 'stream' ? 'live' : 'periodic', level, ageMs };
}
