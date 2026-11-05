import { parseQuotes, type Quote } from '@nerkh/data';

/**
 * Result of turning one raw text frame into data. Pure and synchronous, so it
 * runs the same in a Web Worker, on the main thread and in tests.
 */
export type ParseOutcome =
  /** A batch of quotes; broken entries were dropped and counted. */
  | { kind: 'quotes'; quotes: Quote[]; rejected: number }
  /** Any other well-formed message (e.g. `subscribed`, `error`), passed through as-is. */
  | { kind: 'other'; type: string; message: Record<string, unknown> }
  /** Not JSON, not an object, or a `quotes` message without a quotes array. Nothing reaches the store. */
  | { kind: 'invalid'; error: string };

export function parseServerMessage(raw: string): ParseOutcome {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'invalid', error: 'Not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { kind: 'invalid', error: 'Message must be a JSON object' };
  }

  const message = data as Record<string, unknown>;
  if (typeof message.type !== 'string') return { kind: 'invalid', error: 'Message has no "type"' };

  if (message.type === 'quotes') {
    if (!Array.isArray(message.quotes)) return { kind: 'invalid', error: '"quotes" must be an array' };
    const { quotes, rejected } = parseQuotes(message.quotes);
    return { kind: 'quotes', quotes, rejected: rejected.length };
  }
  return { kind: 'other', type: message.type, message };
}
