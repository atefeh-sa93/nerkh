import { describe, expect, it } from 'vitest';
import { formatAge, formatChange, formatPrice, freshnessOf, STALE_AFTER_MS } from './format';

describe('formatPrice', () => {
  it('groups thousands and picks decimals by magnitude', () => {
    expect(formatPrice(63412.5)).toBe('63,412.50');
    expect(formatPrice(142.87)).toBe('142.87');
    expect(formatPrice(1.0842)).toBe('1.0842');
    expect(formatPrice(0.5)).toBe('0.5000');
  });
});

describe('formatChange', () => {
  it('always shows a sign, using a real minus', () => {
    expect(formatChange(2.314)).toBe('+2.31%');
    expect(formatChange(-3.48)).toBe('−3.48%');
    expect(formatChange(0)).toBe('0.00%');
    expect(formatChange(-0.001)).toBe('0.00%');
    expect(formatChange(null)).toBe('—');
  });
});

describe('formatAge', () => {
  it('reads like the design: 0.4s, 12s, 6m, 2h', () => {
    expect(formatAge(400)).toBe('0.4s');
    expect(formatAge(12_300)).toBe('12s');
    expect(formatAge(6 * 60_000 + 5000)).toBe('6m');
    expect(formatAge(2 * 3_600_000)).toBe('2h');
    expect(formatAge(-50)).toBe('0.0s');
  });
});

describe('freshnessOf', () => {
  const now = 1_000_000;

  it('a fresh stream quote is live with a full bar', () => {
    expect(freshnessOf({ kind: 'stream', updatedAt: now }, now)).toEqual({
      state: 'live',
      level: 1,
      ageMs: 0,
    });
  });

  it('a periodic quote is never called live', () => {
    const f = freshnessOf({ kind: 'periodic', updatedAt: now - 6 * 60_000 }, now);
    expect(f.state).toBe('periodic');
    expect(f.level).toBeCloseTo(0.7, 5);
  });

  it('becomes stale at the threshold, for both kinds', () => {
    expect(freshnessOf({ kind: 'stream', updatedAt: now - STALE_AFTER_MS.stream }, now)).toMatchObject({
      state: 'stale',
      level: 0,
    });
    expect(freshnessOf({ kind: 'periodic', updatedAt: now - 22 * 60_000 }, now).state).toBe('stale');
  });

  it('treats a timestamp from the future as age 0', () => {
    expect(freshnessOf({ kind: 'stream', updatedAt: now + 5000 }, now)).toMatchObject({ ageMs: 0, level: 1 });
  });
});
