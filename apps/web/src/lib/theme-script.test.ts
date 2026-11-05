import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, themeInitScript } from './theme-script';

/** Runs the inline script against fake browser globals and returns the data-theme it set. */
function run(stored: string | null, { storageThrows = false } = {}): string | undefined {
  const attrs = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('SecurityError');
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const document = { documentElement: { setAttribute: (n: string, v: string) => void attrs.set(n, v) } };
  new Function('localStorage', 'document', themeInitScript)(localStorage, document);
  return attrs.get('data-theme');
}

describe('themeInitScript', () => {
  it('applies a saved dark or light choice before paint', () => {
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
  });

  it('leaves the OS setting in charge when nothing (or junk) is saved', () => {
    expect(run(null)).toBeUndefined();
    expect(run('purple')).toBeUndefined();
  });

  it('never throws when storage is blocked', () => {
    expect(() => run(null, { storageThrows: true })).not.toThrow();
  });
});
