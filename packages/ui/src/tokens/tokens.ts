/**
 * Colour tokens: the single source for every theme value in Nerkh.
 * tokens.css and tailwind.css are generated from this file
 * (`pnpm --filter @nerkh/ui tokens`) and a test fails if they drift.
 *
 * Price direction is never colour alone: up = blue + ▲, down = orange + ▼,
 * stale = yellow + clock icon. Blue and orange stay distinct for colour-blind users,
 * but they have almost the same lightness (contrast ~1.1:1), so in greyscale only
 * the arrow tells them apart: components must always render the arrow.
 */
export const tokenNames = [
  'bg', // page background
  'surface', // cards, tables
  'rail', // side rail, header
  'border', // dividers
  'text', // primary text
  'muted', // secondary text, labels
  'up', // price went up (blue)
  'down', // price went down (orange)
  'live', // live / connected (green)
  'stale', // stale data text and icon (yellow family)
  'stale-bg', // stale badge and row background
  'focus', // keyboard focus ring
] as const;

export type TokenName = (typeof tokenNames)[number];
export type Theme = 'dark' | 'light';
export type ThemeTokens = Record<TokenName, string>;

export const tokens: Record<Theme, ThemeTokens> = {
  dark: {
    bg: '#131313',
    surface: '#1C1C1C',
    rail: '#1A1A1A',
    border: '#2A2A2A',
    text: '#F2F0EB',
    muted: '#C9C5BD',
    up: '#6FB1FF',
    down: '#FF9F43',
    live: '#3DDC84',
    stale: '#F5D76E',
    'stale-bg': '#3A3410',
    focus: '#6FB1FF',
  },
  light: {
    bg: '#F6F4EF',
    surface: '#FFFFFF',
    rail: '#EDEAE3',
    border: '#DDD8CE',
    text: '#161616',
    muted: '#4F4A42',
    up: '#1F63BE',
    down: '#A65200',
    live: '#1E6B3E',
    stale: '#4A3C00',
    'stale-bg': '#FFF4B8',
    focus: '#1F63BE',
  },
};

/** CSS custom property name for a token, e.g. `--nk-up`. */
export const cssVar = (name: TokenName): `--nk-${TokenName}` => `--nk-${name}`;
