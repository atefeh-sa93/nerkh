import type { StatusInfo } from '@nerkh/ws-client';
import type { Second } from '@/store/feed';

export type Tone = 'live' | 'stale' | 'muted';

/** Header status line: what the connection is doing, in a few words. */
export function describeConnection(
  info: StatusInfo,
  messagesPerSecond: number,
): { text: string; tone: Tone } {
  switch (info.status) {
    case 'connected':
      return { text: `Connected · ${messagesPerSecond} msg/s`, tone: 'live' };
    case 'connecting':
      return { text: 'Connecting…', tone: 'muted' };
    case 'reconnecting':
      return {
        text:
          info.nextRetryMs === undefined
            ? `Reconnecting (attempt ${info.attempt})`
            : `Reconnecting in ${Math.max(1, Math.ceil(info.nextRetryMs / 1000))}s (attempt ${info.attempt})`,
        tone: 'stale',
      };
    case 'paused':
      return { text: 'Paused', tone: 'muted' };
    case 'failed':
      return { text: 'Connection failed', tone: 'stale' };
    default:
      return { text: 'Idle', tone: 'muted' };
  }
}

/** Latest full second, or zeros before the first one is recorded. */
export function lastSecond(seconds: readonly Second[]): Second {
  return seconds.at(-1) ?? { messages: 0, updates: 0, state: 'ok' };
}

export interface RateBar {
  x: number;
  height: number;
  state: Second['state'];
}

/** Bars for the 60-second chart in a width × height box; disrupted seconds keep a small stub so they stay visible. */
export function rateBars(seconds: readonly Second[], slots: number, height: number): RateBar[] {
  const max = Math.max(1, ...seconds.map((s) => s.messages));
  const offset = slots - seconds.length;
  return seconds.map((s, i) => ({
    x: offset + i,
    height: s.state === 'ok' ? Math.max(2, (s.messages / max) * height) : 4,
    state: s.state,
  }));
}
