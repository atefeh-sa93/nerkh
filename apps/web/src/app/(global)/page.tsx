import { MOCK_SYMBOLS } from '@nerkh/data';
import { BenchProbe } from '@/bench/BenchProbe';
import { Header } from '@/components/Header';
import { MarketTable } from '@/components/market/MarketTable';
import { OrderBook } from '@/components/market/OrderBook';
import { PriceAnnouncer } from '@/components/market/PriceAnnouncer';
import { PriceChart } from '@/components/market/PriceChart';
import { SourcesRail } from '@/components/market/SourcesRail';
import { ConnectionStatus, DataModeBadge, PauseButton } from '@/components/market/StreamControls';
import { MarketFeed } from '@/feed/MarketFeed';

const GLOBAL_SYMBOLS = MOCK_SYMBOLS.filter((s) => s.currency !== 'IRR').map((s) => s.symbol);

export default function GlobalPage() {
  return (
    <>
      <MarketFeed symbols={GLOBAL_SYMBOLS} />
      <BenchProbe>
        <PriceAnnouncer />
        <Header locale="en">
          <DataModeBadge />
          <ConnectionStatus />
          <PauseButton />
        </Header>

        {/* Sources rail beside the content on wide screens, above it on phones. */}
        <div className="flex flex-wrap">
          <div className="min-w-0 flex-[1_1_260px] border-border md:max-w-80 md:border-e">
            <SourcesRail />
          </div>

          <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4 px-4 py-6 sm:px-6">
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
              <span className="text-up">▲ up = blue</span> ·{' '}
              <span className="text-down">▼ down = orange</span> ·{' '}
              <span className="rounded bg-stale-bg px-1.5 text-stale">◷ stale = yellow</span> · Display only,
              no trading
            </p>
          </main>
        </div>
      </BenchProbe>
    </>
  );
}
