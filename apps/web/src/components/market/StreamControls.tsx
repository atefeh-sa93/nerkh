'use client';

import { useStore } from 'zustand';
import { describeConnection, lastSecond } from '@/lib/status';
import { feedStore } from '@/store/feed';
import { useConnection } from '@/store/hooks';

/** Header status: connection state and rate, announced politely to screen readers. */
export function ConnectionStatus() {
  const connection = useConnection();
  const messages = useStore(feedStore, (s) => lastSecond(s.seconds).messages);
  const { text, tone } = describeConnection(connection, messages);

  return (
    <span
      role="status"
      className={`flex items-center gap-2 font-mono text-[13px] font-medium ${
        tone === 'live' ? 'text-live' : tone === 'stale' ? 'text-stale' : 'text-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${tone === 'live' ? 'bg-live' : tone === 'stale' ? 'bg-stale' : 'bg-muted'}`}
      />
      {text}
    </span>
  );
}

/** Stops and restarts the stream. While paused, prices age and turn stale. */
export function PauseButton() {
  const paused = useStore(feedStore, (s) => s.paused);

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => feedStore.getState().setPaused(!paused)}
      className="flex min-h-11 items-center gap-2 rounded-[10px] bg-text px-4 text-sm font-semibold text-bg"
    >
      {paused ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 4l13 8-13 8z" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      )}
      {paused ? 'Resume stream' : 'Pause stream'}
    </button>
  );
}

/** Small badge naming where the data comes from (mock in the browser, or a WebSocket server). */
export function DataModeBadge() {
  const source = useStore(feedStore, (s) => s.source);
  if (!source) return null;
  return (
    <span className="rounded-md border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted">
      DATA: {source.id === 'ws-server' ? 'WS' : 'MOCK'}
    </span>
  );
}
