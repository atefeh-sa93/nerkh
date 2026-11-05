import { z } from 'zod';
import type { Quote } from './quote.ts';

const SYMBOL_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+$/;

/** Quote assets that mean an Iranian price. Their stored currency must be rial. */
const IRANIAN_QUOTE_ASSETS = new Set(['IRT', 'IRR']);

/**
 * Runtime check for anything coming from outside (WebSocket messages, API
 * responses, snapshot files). External data never reaches the store unless
 * it passes this schema.
 */
export const QuoteSchema = z
  .object({
    symbol: z.string().regex(SYMBOL_PATTERN, 'symbol must look like BASE-QUOTE, e.g. USD-IRT'),
    name: z.object({
      en: z.string().min(1),
      fa: z.string().min(1).optional(),
    }),
    price: z.number().positive(),
    currency: z.enum(['IRR', 'EUR', 'USD']),
    change24h: z.number().nullable(),
    kind: z.enum(['stream', 'periodic']),
    source: z.string().min(1),
    updatedAt: z.number().int().positive(),
  })
  .refine(
    (q) => {
      const quoteAsset = q.symbol.split('-')[1] ?? '';
      return !IRANIAN_QUOTE_ASSETS.has(quoteAsset) || q.currency === 'IRR';
    },
    { message: 'Iranian prices must be stored in rial (currency IRR)', path: ['currency'] },
  ) satisfies z.ZodType<Quote>;

export type QuoteParseResult = { ok: true; quote: Quote } | { ok: false; error: string };

/** Validate one unknown value. Never throws. */
export function parseQuote(input: unknown): QuoteParseResult {
  const result = QuoteSchema.safeParse(input);
  if (result.success) return { ok: true, quote: result.data };
  return { ok: false, error: z.prettifyError(result.error) };
}

export interface QuotesParseResult {
  quotes: Quote[];
  /** How many inputs were dropped, with the reason for each. */
  rejected: { index: number; error: string }[];
}

/** Validate a batch. Valid quotes are kept, broken ones are counted and dropped. Never throws. */
export function parseQuotes(inputs: readonly unknown[]): QuotesParseResult {
  const quotes: Quote[] = [];
  const rejected: QuotesParseResult['rejected'] = [];
  inputs.forEach((input, index) => {
    const result = parseQuote(input);
    if (result.ok) quotes.push(result.quote);
    else rejected.push({ index, error: result.error });
  });
  return { quotes, rejected };
}
