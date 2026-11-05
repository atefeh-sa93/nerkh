import type { Theme } from './tokens.ts';

/** What the user picked. `system` follows the OS light/dark setting. */
export type ThemePreference = Theme | 'system';

export const THEME_ATTRIBUTE = 'data-theme';

/** The theme actually shown for a preference, given whether the OS prefers dark. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** The part of an element applyTheme needs; keeps it testable without a DOM. */
export interface ThemeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Applies a preference to an element (usually <html>, or the widget host).
 * `system` removes the attribute so tokens.css follows prefers-color-scheme.
 */
export function applyTheme(preference: ThemePreference, target: ThemeTarget): void {
  if (preference === 'system') target.removeAttribute(THEME_ATTRIBUTE);
  else target.setAttribute(THEME_ATTRIBUTE, preference);
}

/** Next value for a theme toggle button: light ⇄ dark, starting from what is shown. */
export function toggleTheme(shown: Theme): Theme {
  return shown === 'dark' ? 'light' : 'dark';
}
