import { Header } from '@/components/Header';

export default function GlobalPage() {
  return (
    <>
      <Header locale="en" />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8">
        <h1 className="m-0 text-base font-medium text-muted">Global markets</h1>
        <p className="m-0 max-w-prose text-muted">
          Live market table, price chart, order book and data sources arrive in the next issues (#17–#21).
        </p>
        <p className="m-0 font-mono text-sm text-muted">
          <span className="text-up">▲ up</span> · <span className="text-down">▼ down</span> ·{' '}
          <span className="rounded bg-stale-bg px-1.5 text-stale">◷ stale</span> ·{' '}
          <span className="text-live">● live</span>
        </p>
      </main>
    </>
  );
}
