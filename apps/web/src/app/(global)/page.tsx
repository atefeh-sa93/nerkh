import { MOCK_SYMBOLS } from '@nerkh/data';
import { Header } from '@/components/Header';
import { MarketTable } from '@/components/market/MarketTable';
import { MarketFeed } from '@/feed/MarketFeed';

const GLOBAL_SYMBOLS = MOCK_SYMBOLS.filter((s) => s.currency !== 'IRR').map((s) => s.symbol);

export default function GlobalPage() {
  return (
    <>
      <MarketFeed symbols={GLOBAL_SYMBOLS} />
      <Header locale="en" />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="sr-only">Global markets</h1>
        <MarketTable />
        <p className="m-0 font-mono text-xs text-muted">
          <span className="text-up">▲ up = blue</span> · <span className="text-down">▼ down = orange</span> ·{' '}
          <span className="rounded bg-stale-bg px-1.5 text-stale">◷ stale = yellow</span> · Display only, no
          trading
        </p>
      </main>
    </>
  );
}
