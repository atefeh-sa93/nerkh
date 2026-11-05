export interface BackoffOptions {
  /** Wait before the first retry. Default 1000 ms. */
  initialDelayMs: number;
  /** Upper bound for any wait. Default 30 000 ms. */
  maxDelayMs: number;
  /** Growth per attempt. Default 2 (1 s, 2 s, 4 s, 8 s ...). */
  factor: number;
  /**
   * Random spread as a fraction of the delay. 0.3 means ±30 %. Spreads out
   * reconnects so thousands of clients dropped at once don't return together.
   */
  jitter: number;
  /** Give up after this many failed attempts in a row. Default 10. */
  maxRetries: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  factor: 2,
  jitter: 0.3,
  maxRetries: 10,
};

/**
 * Delay before retry number `attempt` (1-based): exponential growth, capped,
 * with ±jitter. `random` returns [0, 1); inject it in tests.
 */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const { initialDelayMs, maxDelayMs, factor, jitter } = options;
  const base = Math.min(maxDelayMs, initialDelayMs * factor ** Math.max(0, attempt - 1));
  const spread = 1 - jitter + random() * 2 * jitter;
  return Math.round(Math.min(maxDelayMs, base * spread));
}
