import { MOCK_SYMBOLS } from '@nerkh/data';
import { Header } from '@/components/Header';
import { MarketTable } from '@/components/market/MarketTable';
import { OrderBook } from '@/components/market/OrderBook';
import { PriceChart } from '@/components/market/PriceChart';
import { MarketFeed } from '@/feed/MarketFeed';

const GLOBAL_SYMBOLS = MOCK_SYMBOLS.filter((s) => s.currency !== 'IRR').map((s) => s.symbol);

export default function GlobalPage() {
  return (
    <>
      <MarketFeed symbols={GLOBAL_SYMBOLS} />
      <Header locale="en" />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="sr-only">Global markets</h1>
        <PriceChart />
        {/* Table and order book side by side; the book drops below on narrow screens. */}
        <div className="flex flex-wrap gap-y-4">
          <div className="min-w-0 flex-[999_1_520px]">
            <MarketTable />
          </div>
          <div className="min-w-0 flex-[1_1_260px] sm:border-s sm:border-border">
            <OrderBook />
          </div>
        </div>
        <p className="m-0 font-mono text-xs text-muted">
          <span className="text-up">▲ up = blue</span> · <span className="text-down">▼ down = orange</span> ·{' '}
          <span className="rounded bg-stale-bg px-1.5 text-stale">◷ stale = yellow</span> · Display only, no
          trading
        </p>
      </main>
    </>
  );
}
