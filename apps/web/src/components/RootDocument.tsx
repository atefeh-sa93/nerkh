import { themeInitScript } from '@/lib/theme-script';
import type { Locale } from './Header';

/** <html> for one mode. Global and Iran are separate root layouts because lang and dir differ. */
export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html
      lang={locale}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      // The theme script sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`bg-bg text-text antialiased ${locale === 'fa' ? 'font-fa' : 'font-sans'}`}>
        {children}
      </body>
    </html>
  );
}
