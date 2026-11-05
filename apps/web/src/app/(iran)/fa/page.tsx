import { Header } from '@/components/Header';

export default function IranPage() {
  return (
    <>
      <Header locale="fa" />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8">
        <h1 className="m-0 text-base font-medium text-muted">بازار ایران</h1>
        <p className="m-0 max-w-prose leading-8 text-muted">
          کارت‌ها، نمودار ۳۰ روزه، جدول نرخ‌ها و سوئیچ تومان و ریال در issueهای روز ۵ اضافه می‌شوند.
        </p>
        <p className="m-0 text-sm text-muted">
          <span className="text-up">▲ افزایش</span> · <span className="text-down">▼ کاهش</span> ·{' '}
          <span className="rounded bg-stale-bg px-1.5 text-stale">◷ کهنه</span> ·{' '}
          <span className="text-live">● زنده</span>
        </p>
      </main>
    </>
  );
}
