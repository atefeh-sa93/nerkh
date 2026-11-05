import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.ts';
import { generateTailwindCss, generateTokensCss } from './generate.ts';
import { applyTheme, resolveTheme, toggleTheme, type ThemeTarget } from './theme.ts';
import { tokenNames, tokens, type Theme, type TokenName } from './tokens.ts';

const themes: Theme[] = ['dark', 'light'];

/** Every text colour and the backgrounds it is drawn on in the final design. */
const textPairs: [TokenName, TokenName][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'rail'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'rail'],
  ['up', 'bg'],
  ['up', 'surface'],
  ['up', 'rail'],
  ['down', 'bg'],
  ['down', 'surface'],
  ['down', 'rail'],
  ['live', 'bg'],
  ['live', 'surface'],
  ['stale', 'stale-bg'],
  ['stale', 'bg'],
];

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });
});

describe('tokens', () => {
  it.each(themes)('%s theme defines every token as #RRGGBB', (theme) => {
    for (const name of tokenNames) expect(tokens[theme][name]).toMatch(/^#[0-9A-F]{6}$/);
  });

  describe.each(themes)('%s theme text contrast is at least 4.5:1', (theme) => {
    it.each(textPairs)('%s on %s', (fg, bg) => {
      expect(contrastRatio(tokens[theme][fg], tokens[theme][bg])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it.each(themes)('%s theme: focus ring is visible against the page (3:1)', (theme) => {
    expect(contrastRatio(tokens[theme].focus, tokens[theme].bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('generated CSS', () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
  const normalise = (css: string) => css.replace(/\s+/g, ' ').trim();

  it('tokens.css is in sync with tokens.ts (run `pnpm --filter @nerkh/ui tokens`)', () => {
    expect(normalise(read('./tokens.css'))).toBe(normalise(generateTokensCss()));
  });

  it('tailwind.css is in sync with tokens.ts (run `pnpm --filter @nerkh/ui tokens`)', () => {
    expect(normalise(read('./tailwind.css'))).toBe(normalise(generateTailwindCss()));
  });

  it('defines every token for both themes and honours data-theme and the OS setting', () => {
    const css = generateTokensCss();
    for (const name of tokenNames) {
      expect(css).toContain(`--nk-${name}: ${tokens.light[name].toLowerCase()};`);
      expect(css).toContain(`--nk-${name}: ${tokens.dark[name].toLowerCase()};`);
    }
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-theme='light'])");
    expect(css).toContain("[data-theme='dark']");
  });
});

describe('theme helpers', () => {
  function fakeElement() {
    const attrs = new Map<string, string>();
    const el: ThemeTarget = {
      setAttribute: (n, v) => void attrs.set(n, v),
      removeAttribute: (n) => void attrs.delete(n),
    };
    return { el, attrs };
  }

  it('resolves system to the OS setting and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('sets data-theme for explicit choices and removes it for system', () => {
    const { el, attrs } = fakeElement();
    applyTheme('dark', el);
    expect(attrs.get('data-theme')).toBe('dark');
    applyTheme('system', el);
    expect(attrs.has('data-theme')).toBe(false);
  });

  it('toggles between light and dark', () => {
    expect(toggleTheme('dark')).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
  });
});
