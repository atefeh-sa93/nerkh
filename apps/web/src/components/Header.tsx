import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export type Locale = 'en' | 'fa';

const copy = {
  en: { brand: 'nerkh', market: 'Market' },
  fa: { brand: 'نرخ', market: 'بازار' },
} as const;

/** Top bar shared by both modes: brand, Global/Iran switch, theme toggle, and a slot for status. */
export function Header({ locale, children }: { locale: Locale; children?: React.ReactNode }) {
  const t = copy[locale];
  const tab =
    'flex min-h-11 items-center px-4 text-sm no-underline transition-colors hover:bg-surface hover:text-text';

  return (
    <header className="flex flex-wrap items-center gap-3.5 border-b border-border bg-rail px-5 py-2.5">
      <span className={locale === 'fa' ? 'text-2xl font-extrabold' : 'text-[22px] font-bold tracking-tight'}>
        {t.brand}
        <span className="text-up">.</span>
      </span>

      <nav aria-label={t.market} className="flex overflow-hidden rounded-[10px] border border-border">
        <Link
          href="/"
          aria-current={locale === 'en' ? 'page' : undefined}
          className={`${tab} font-sans ${locale === 'en' ? 'bg-text font-semibold text-bg hover:bg-text hover:text-bg' : 'text-muted'}`}
        >
          Global
        </Link>
        <Link
          href="/fa/"
          aria-current={locale === 'fa' ? 'page' : undefined}
          className={`${tab} font-fa ${locale === 'fa' ? 'bg-text font-bold text-bg hover:bg-text hover:text-bg' : 'text-muted'}`}
        >
          ایران
        </Link>
      </nav>

      <div className="flex-1" />
      {children}
      <ThemeToggle locale={locale} />
    </header>
  );
}
