import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource-variable/vazirmatn';
import '@/styles/globals.css';
import type { Metadata } from 'next';
import { RootDocument } from '@/components/RootDocument';

export const metadata: Metadata = {
  title: 'نرخ · قیمت لحظه‌ای بازار ایران',
  description: 'دلار، یورو، سکه، طلا، نقره و تتر؛ زنده و دوره‌ای، با نمایش صادقانه کهنگی داده.',
};

export default function IranLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="fa">{children}</RootDocument>;
}
