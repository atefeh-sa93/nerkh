import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource-variable/vazirmatn';
import '@/styles/globals.css';
import type { Metadata } from 'next';
import { RootDocument } from '@/components/RootDocument';

export const metadata: Metadata = {
  title: 'Nerkh · Live markets',
  description: 'Real-time market dashboard: crypto, FX, gold and stocks.',
};

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
