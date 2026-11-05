import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, DEFAULT_BACKOFF } from './backoff.ts';
import { createWsClient, type SocketLike, type StatusInfo, type WsClientOptions } from './client.ts';

/** In-memory socket the test drives by hand: open(), message(), drop(). */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closedWith: number | undefined;
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onerror: SocketLike['onerror'] = null;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number) {
    this.closedWith = code;
    this.readyState = 3;
  }
  // Test controls
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  message(data: unknown) {
    this.onmessage?.({ data });
  }
  drop(code = 1012) {
    this.readyState = 3;
    this.onerror?.({});
    this.onclose?.({ code });
  }
}

function setup(options: Partial<WsClientOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const statuses: StatusInfo[] = [];
  const client = createWsClient({
    url: 'ws://test',
    random: () => 0.5, // no jitter: delays are exactly 1 s, 2 s, 4 s ...
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    ...options,
  });
  client.on('status', (info) => statuses.push(info));
  const latest = () => sockets.at(-1) as FakeSocket;
  return { client, sockets, statuses, latest };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('backoffDelay', () => {
  const noJitter = { ...DEFAULT_BACKOFF, jitter: 0 };

  it('doubles from the initial delay', () => {
    expect([1, 2, 3, 4, 5].map((n) => backoffDelay(n, noJitter))).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('never exceeds the cap', () => {
    expect(backoffDelay(6, noJitter)).toBe(30_000);
    expect(backoffDelay(50, noJitter)).toBe(30_000);
    expect(backoffDelay(50, DEFAULT_BACKOFF, () => 0.999)).toBe(30_000);
  });

  it('spreads delays by ±jitter', () => {
    expect(backoffDelay(3, DEFAULT_BACKOFF, () => 0)).toBe(2800); // 4000 × 0.7
    expect(backoffDelay(3, DEFAULT_BACKOFF, () => 0.5)).toBe(4000);
    expect(backoffDelay(3, DEFAULT_BACKOFF, () => 0.999_999)).toBe(5200); // 4000 × 1.3
  });
});

describe('createWsClient', () => {
  it('starts idle and does nothing until connect()', () => {
    const { client, sockets } = setup();
    expect(client.status).toBe('idle');
    expect(sockets).toHaveLength(0);
  });

  it('connects, reports status and forwards text messages', () => {
    const { client, latest, statuses } = setup();
    const messages: string[] = [];
    client.on('message', (m) => messages.push(m));

    client.connect();
    expect(client.status).toBe('connecting');
    latest().open();
    expect(client.status).toBe('connected');

    latest().message('{"type":"quotes"}');
    latest().message(new ArrayBuffer(4)); // binary frames are ignored
    expect(messages).toEqual(['{"type":"quotes"}']);
    expect(statuses.map((s) => s.status)).toEqual(['connecting', 'connected']);
  });

  it('sends the subscription on open, and right away when already open', () => {
    const { client, latest } = setup();
    client.setSubscription('sub-1');
    client.connect();
    latest().open();
    expect(latest().sent).toEqual(['sub-1']);

    client.setSubscription('sub-2');
    expect(latest().sent).toEqual(['sub-1', 'sub-2']);
  });

  it('reconnects with exponential backoff after a drop', () => {
    const { client, sockets, latest, statuses } = setup();
    client.connect();
    latest().open();

    latest().drop();
    expect(client.status).toBe('reconnecting');
    expect(statuses.at(-1)).toEqual({ status: 'reconnecting', attempt: 1, nextRetryMs: 1000 });

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    latest().drop(); // second try fails before opening
    expect(statuses.at(-1)).toEqual({ status: 'reconnecting', attempt: 2, nextRetryMs: 2000 });
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
  });

  it('after reconnecting: resubscribes, reports reconnected and resets the backoff', () => {
    const { client, latest, statuses } = setup();
    const opens: boolean[] = [];
    client.on('open', ({ reconnected }) => opens.push(reconnected));
    client.setSubscription('sub');

    client.connect();
    latest().open();
    latest().drop();
    vi.advanceTimersByTime(1000);
    latest().drop();
    vi.advanceTimersByTime(2000);
    latest().open();

    expect(client.status).toBe('connected');
    expect(latest().sent).toEqual(['sub']);
    expect(opens).toEqual([false, true]);

    latest().drop(); // the next drop starts again at 1 s
    expect(statuses.at(-1)).toMatchObject({ attempt: 1, nextRetryMs: 1000 });
  });

  it('gives up after maxRetries and can be restarted with connect()', () => {
    const { client, sockets, latest } = setup({ backoff: { maxRetries: 3 } });
    client.connect();
    for (let i = 0; i < 4; i++) {
      latest().drop();
      vi.advanceTimersByTime(60_000);
    }
    expect(client.status).toBe('failed');
    const count = sockets.length;
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(count);

    client.connect();
    expect(sockets).toHaveLength(count + 1);
  });

  it('close() stops for good: no reconnect, socket closed with 1000', () => {
    const { client, sockets, latest } = setup();
    client.connect();
    latest().open();
    const s = latest();

    client.close();
    expect(client.status).toBe('paused');
    expect(s.closedWith).toBe(1000);

    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(1);
  });

  it('close() during the reconnect wait cancels the retry', () => {
    const { client, sockets, latest } = setup();
    client.connect();
    latest().open();
    latest().drop();
    client.close();
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(1);
    expect(client.status).toBe('paused');
  });

  it('connect() after close() resumes', () => {
    const { client, latest } = setup();
    client.connect();
    latest().open();
    client.close();
    client.connect();
    latest().open();
    expect(client.status).toBe('connected');
  });

  it('send() only works while connected', () => {
    const { client, latest } = setup();
    expect(client.send('x')).toBe(false);
    client.connect();
    expect(client.send('x')).toBe(false);
    latest().open();
    expect(client.send('x')).toBe(true);
    expect(latest().sent).toEqual(['x']);
  });

  it('treats a socket that throws on creation as a failed attempt', () => {
    let calls = 0;
    const client = createWsClient({
      url: 'ws://bad',
      random: () => 0.5,
      createSocket: () => {
        calls++;
        throw new Error('bad url');
      },
    });
    client.connect();
    expect(client.status).toBe('reconnecting');
    vi.advanceTimersByTime(1000);
    expect(calls).toBe(2);
  });

  it('unsubscribing a listener stops its events', () => {
    const { client, latest } = setup();
    const handler = vi.fn();
    const off = client.on('message', handler);
    client.connect();
    latest().open();
    off();
    latest().message('ignored');
    expect(handler).not.toHaveBeenCalled();
  });
});
