import type { Quote } from '@nerkh/data';

/**
 * Wire protocol, JSON text frames.
 *
 * Client → server:
 *   { "type": "subscribe", "symbols": ["BTC-EUR", "USD-IRT"] }   replaces the current subscription
 *   { "type": "unsubscribe" }
 *
 * Server → client:
 *   { "type": "subscribed", "symbols": [...] }   the known symbols you will receive
 *   { "type": "quotes", "quotes": [Quote, ...] } a batch, sent every tick that has data for you
 *   { "type": "error", "message": "..." }        bad message; the connection stays open
 */
export type ClientMessage = { type: 'subscribe'; symbols: string[] } | { type: 'unsubscribe' };

export type ServerMessage =
  | { type: 'subscribed'; symbols: string[] }
  | { type: 'quotes'; quotes: Quote[] }
  | { type: 'error'; message: string };

export type ParsedClientMessage = { ok: true; message: ClientMessage } | { ok: false; error: string };

const MAX_SYMBOLS = 100;

export function parseClientMessage(raw: string): ParsedClientMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Message is not valid JSON' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'Message must be an object' };

  const { type, symbols } = data as { type?: unknown; symbols?: unknown };
  if (type === 'unsubscribe') return { ok: true, message: { type } };
  if (type === 'subscribe') {
    if (!Array.isArray(symbols) || !symbols.every((s) => typeof s === 'string')) {
      return { ok: false, error: '"symbols" must be an array of strings' };
    }
    if (symbols.length > MAX_SYMBOLS) return { ok: false, error: `At most ${MAX_SYMBOLS} symbols` };
    return { ok: true, message: { type, symbols } };
  }
  return { ok: false, error: 'Unknown message type; expected "subscribe" or "unsubscribe"' };
}
