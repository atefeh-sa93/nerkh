import { describe, expect, it } from 'vitest';
import { parseQuote, parseQuotes } from './schema.ts';
import type { Quote } from './quote.ts';

const btc: Quote = {
  symbol: 'BTC-EUR',
  name: { en: 'Bitcoin' },
  price: 63412.5,
  currency: 'EUR',
  change24h: 2.31,
  kind: 'stream',
  source: 'mock-stream',
  updatedAt: 1793866630000,
};

const usdIrt: Quote = {
  symbol: 'USD-IRT',
  name: { en: 'US Dollar', fa: 'دلار آمریکا' },
  price: 824500, // rial
  currency: 'IRR',
  change24h: 1.24,
  kind: 'periodic',
  source: 'price-service',
  updatedAt: 1793866270000,
};

describe('parseQuote: valid input', () => {
  it('accepts a Global stream quote', () => {
    expect(parseQuote(btc)).toEqual({ ok: true, quote: btc });
  });

  it('accepts an Iranian periodic quote with a Persian name', () => {
    expect(parseQuote(usdIrt)).toEqual({ ok: true, quote: usdIrt });
  });

  it('accepts a missing 24h change as null', () => {
    expect(parseQuote({ ...btc, change24h: null }).ok).toBe(true);
  });

  it('strips unknown fields so raw source data does not leak into the store', () => {
    const result = parseQuote({ ...btc, rawPayload: { secret: 1 } });
    expect(result.ok && 'rawPayload' in result.quote).toBe(false);
  });
});

describe('parseQuote: broken input is rejected', () => {
  const cases: [string, unknown][] = [
    ['null', null],
    ['a string', 'BTC-EUR 63412'],
    ['missing symbol', { ...btc, symbol: undefined }],
    ['lower-case symbol', { ...btc, symbol: 'btc-eur' }],
    ['symbol without a dash', { ...btc, symbol: 'BTCEUR' }],
    ['price sent as a string', { ...btc, price: '63412.5' }],
    ['zero price', { ...btc, price: 0 }],
    ['negative price', { ...btc, price: -1 }],
    ['NaN price', { ...btc, price: Number.NaN }],
    ['infinite price', { ...btc, price: Number.POSITIVE_INFINITY }],
    ['unknown currency', { ...btc, currency: 'GBP' }],
    ['unknown kind', { ...btc, kind: 'live' }],
    ['empty source', { ...btc, source: '' }],
    ['fractional timestamp', { ...btc, updatedAt: 1.5 }],
    ['timestamp in seconds as a string', { ...btc, updatedAt: '1793866630' }],
    ['empty English name', { ...btc, name: { en: '' } }],
  ];

  it.each(cases)('rejects %s', (_label, input) => {
    const result = parseQuote(input);
    expect(result.ok).toBe(false);
  });

  it('rejects an Iranian price that is not stored in rial (the 10x toman bug)', () => {
    const result = parseQuote({ ...usdIrt, price: 82450, currency: 'USD' });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain('rial');
  });
});

describe('parseQuotes', () => {
  it('keeps valid quotes, drops broken ones and reports which', () => {
    const { quotes, rejected } = parseQuotes([btc, { ...btc, price: -5 }, usdIrt, 'garbage']);
    expect(quotes).toEqual([btc, usdIrt]);
    expect(rejected.map((r) => r.index)).toEqual([1, 3]);
    expect(rejected.every((r) => r.error.length > 0)).toBe(true);
  });

  it('returns empty results for an empty batch', () => {
    expect(parseQuotes([])).toEqual({ quotes: [], rejected: [] });
  });
});
