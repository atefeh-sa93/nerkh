'use client';

import { applyTheme, resolveTheme, toggleTheme, type Theme, THEME_ATTRIBUTE } from '@nerkh/ui';
import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme-script';

const labels = {
  en: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  fa: { toDark: 'تغییر به تم تیره', toLight: 'تغییر به تم روشن' },
} as const;

function shownTheme(): Theme {
  const explicit = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (explicit === 'dark' || explicit === 'light') return explicit;
  return resolveTheme('system', window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] });
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}

export function ThemeToggle({ locale }: { locale: 'en' | 'fa' }) {
  // null on the server: the real theme is only known in the browser.
  const theme = useSyncExternalStore<Theme | null>(subscribe, shownTheme, () => null);
  const t = labels[locale];

  function onClick() {
    const next = toggleTheme(shownTheme());
    applyTheme(next, document.documentElement);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme === 'dark' ? t.toLight : t.toDark}
      className="inline-flex size-11 items-center justify-center rounded-[10px] border border-border bg-surface text-text"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
