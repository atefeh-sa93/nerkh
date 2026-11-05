import type { Currency, Quote } from '../quote.ts';

export interface MockSymbol {
  symbol: string;
  name: Quote['name'];
  currency: Currency;
  /** Starting price, also used as the 24h reference. Iranian prices are in rial. */
  basePrice: number;
  /** Largest relative move per message, e.g. 0.0002 = 0.02%. */
  volatility: number;
  /** Decimal places to round to (0 for rial). */
  decimals: number;
}

/** Illustrative starting prices for the mock stream; not real market data. */
export const MOCK_SYMBOLS: readonly MockSymbol[] = [
  // Global
  {
    symbol: 'BTC-EUR',
    name: { en: 'Bitcoin' },
    currency: 'EUR',
    basePrice: 63412.5,
    volatility: 0.0002,
    decimals: 2,
  },
  {
    symbol: 'ETH-EUR',
    name: { en: 'Ethereum' },
    currency: 'EUR',
    basePrice: 3108.22,
    volatility: 0.00025,
    decimals: 2,
  },
  {
    symbol: 'SOL-EUR',
    name: { en: 'Solana' },
    currency: 'EUR',
    basePrice: 142.87,
    volatility: 0.00038,
    decimals: 2,
  },
  {
    symbol: 'EUR-USD',
    name: { en: 'Euro / Dollar' },
    currency: 'USD',
    basePrice: 1.0842,
    volatility: 0.000025,
    decimals: 4,
  },
  {
    symbol: 'GBP-USD',
    name: { en: 'Pound / Dollar' },
    currency: 'USD',
    basePrice: 1.2671,
    volatility: 0.000025,
    decimals: 4,
  },
  {
    symbol: 'XAU-USD',
    name: { en: 'Gold spot' },
    currency: 'USD',
    basePrice: 2384.1,
    volatility: 0.000075,
    decimals: 2,
  },
  {
    symbol: 'AAPL-USD',
    name: { en: 'Apple Inc.' },
    currency: 'USD',
    basePrice: 214.08,
    volatility: 0.00013,
    decimals: 2,
  },
  {
    symbol: 'TSLA-USD',
    name: { en: 'Tesla Inc.' },
    currency: 'USD',
    basePrice: 248.61,
    volatility: 0.00025,
    decimals: 2,
  },
  {
    symbol: 'NVDA-USD',
    name: { en: 'NVIDIA' },
    currency: 'USD',
    basePrice: 118.44,
    volatility: 0.0002,
    decimals: 2,
  },
  // Iran (rial)
  {
    symbol: 'USD-IRT',
    name: { en: 'US Dollar', fa: 'دلار آمریکا' },
    currency: 'IRR',
    basePrice: 824_500,
    volatility: 0.000075,
    decimals: 0,
  },
  {
    symbol: 'EUR-IRT',
    name: { en: 'Euro', fa: 'یورو' },
    currency: 'IRR',
    basePrice: 891_200,
    volatility: 0.000075,
    decimals: 0,
  },
  {
    symbol: 'GBP-IRT',
    name: { en: 'British Pound', fa: 'پوند' },
    currency: 'IRR',
    basePrice: 1_043_100,
    volatility: 0.000075,
    decimals: 0,
  },
  {
    symbol: 'COIN-IRT',
    name: { en: 'Emami Gold Coin', fa: 'سکه امامی' },
    currency: 'IRR',
    basePrice: 718_000_000,
    volatility: 0.00005,
    decimals: 0,
  },
  {
    symbol: 'GOLD18-IRT',
    name: { en: '18k Gold (gram)', fa: 'طلای ۱۸ عیار' },
    currency: 'IRR',
    basePrice: 70_450_000,
    volatility: 0.00005,
    decimals: 0,
  },
  {
    symbol: 'SILVER-IRT',
    name: { en: 'Silver (gram)', fa: 'نقره' },
    currency: 'IRR',
    basePrice: 862_000,
    volatility: 0.0001,
    decimals: 0,
  },
  {
    symbol: 'USDT-IRT',
    name: { en: 'Tether', fa: 'تتر' },
    currency: 'IRR',
    basePrice: 829_800,
    volatility: 0.000075,
    decimals: 0,
  },
  {
    symbol: 'BTC-IRT',
    name: { en: 'Bitcoin', fa: 'بیت‌کوین' },
    currency: 'IRR',
    basePrice: 57_040_000_000,
    volatility: 0.0002,
    decimals: 0,
  },
];
