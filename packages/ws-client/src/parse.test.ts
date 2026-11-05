import type { Quote } from '@nerkh/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseServerMessage, type ParseOutcome } from './parse.ts';
import { createMessageParser, type WorkerLike } from './parser.ts';
import type { WorkerRequest, WorkerResponse } from './worker.ts';

const btc: Quote = {
  symbol: 'BTC-EUR',
  name: { en: 'Bitcoin' },
  price: 63412.5,
  currency: 'EUR',
  change24h: 2.31,
  kind: 'stream',
  source: 'mock-stream',
  updatedAt: 1793866630000,
};
const frame = (quotes: unknown[]) => JSON.stringify({ type: 'quotes', quotes });

describe('parseServerMessage', () => {
  it('returns valid quotes from a quotes frame', () => {
    expect(parseServerMessage(frame([btc]))).toEqual({ kind: 'quotes', quotes: [btc], rejected: 0 });
  });

  it('drops broken quotes and counts them, keeping the good ones', () => {
    const outcome = parseServerMessage(frame([btc, { ...btc, price: -1 }, 'junk']));
    expect(outcome).toEqual({ kind: 'quotes', quotes: [btc], rejected: 2 });
  });

  it('passes other message types through', () => {
    expect(parseServerMessage('{"type":"subscribed","symbols":["BTC-EUR"]}')).toEqual({
      kind: 'other',
      type: 'subscribed',
      message: { type: 'subscribed', symbols: ['BTC-EUR'] },
    });
  });

  it.each([
    ['bad JSON', '{oops'],
    ['a number', '42'],
    ['an array', '[1,2]'],
    ['null', 'null'],
    ['no type', '{"quotes":[]}'],
    ['quotes not an array', '{"type":"quotes","quotes":{}}'],
  ])('marks %s as invalid', (_label, raw) => {
    expect(parseServerMessage(raw).kind).toBe('invalid');
  });
});

describe('createMessageParser: main-thread fallback', () => {
  it('parses inline when there is no worker, and keeps stats', () => {
    const results: ParseOutcome[] = [];
    const parser = createMessageParser({ onResult: (o) => results.push(o) });

    parser.parse(frame([btc, { ...btc, symbol: 'bad' }]));
    parser.parse('{oops');
    parser.parse('{"type":"subscribed","symbols":[]}');

    expect(results.map((r) => r.kind)).toEqual(['quotes', 'invalid', 'other']);
    expect(parser.stats).toEqual({
      frames: 3,
      quotes: 1,
      rejectedQuotes: 1,
      invalidFrames: 1,
      mode: 'main-thread',
    });
  });
});

/** Fake worker that runs the real worker logic asynchronously, like a real one. */
class FakeWorker implements WorkerLike {
  posted: WorkerRequest[] = [];
  terminated = false;
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;

  postMessage(message: WorkerRequest) {
    this.posted.push(message);
    const frames = Array.isArray(message) ? message : [message];
    const response: WorkerResponse = frames.map(parseServerMessage);
    queueMicrotask(() => this.onmessage?.({ data: response }));
  }
  terminate() {
    this.terminated = true;
  }
}

describe('createMessageParser: with a worker', () => {
  it('hands raw frames to the worker and delivers its results in order', async () => {
    const worker = new FakeWorker();
    const results: ParseOutcome[] = [];
    const parser = createMessageParser({ worker, onResult: (o) => results.push(o) });

    parser.parse(frame([btc]));
    parser.parse('{oops');
    expect(worker.posted).toHaveLength(2);
    expect(results).toHaveLength(0); // nothing parsed on the main thread
    await Promise.resolve();

    expect(results.map((r) => r.kind)).toEqual(['quotes', 'invalid']);
    expect(parser.stats).toMatchObject({ frames: 2, quotes: 1, invalidFrames: 1, mode: 'worker' });
  });

  it('falls back to the main thread if the worker errors', () => {
    const worker = new FakeWorker();
    const results: ParseOutcome[] = [];
    const parser = createMessageParser({ worker, onResult: (o) => results.push(o) });

    worker.onerror?.(new Error('crashed'));
    expect(worker.terminated).toBe(true);
    expect(parser.stats.mode).toBe('main-thread');

    parser.parse(frame([btc]));
    expect(results).toEqual([{ kind: 'quotes', quotes: [btc], rejected: 0 }]); // synchronous now
  });

  it('terminate() stops the worker and keeps parsing inline', () => {
    const worker = new FakeWorker();
    const onResult = vi.fn();
    const parser = createMessageParser({ worker, onResult });
    parser.terminate();
    parser.parse(frame([btc]));
    expect(worker.terminated).toBe(true);
    expect(worker.posted).toHaveLength(0);
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});

/** A worker whose script never loaded: accepts messages, never answers, never errors. */
class DeadWorker implements WorkerLike {
  posted = 0;
  terminated = false;
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  postMessage() {
    this.posted++;
  }
  terminate() {
    this.terminated = true;
  }
}

describe('createMessageParser: a worker that never answers', () => {
  afterEach(() => vi.useRealTimers());

  it('gives up after the timeout and re-parses everything it was handed', () => {
    vi.useFakeTimers();
    const worker = new DeadWorker();
    const results: ParseOutcome[] = [];
    const parser = createMessageParser({ worker, onResult: (o) => results.push(o), workerTimeoutMs: 3000 });

    parser.parse(frame([btc]));
    parser.parse(frame([{ ...btc, price: 2 }]));
    vi.advanceTimersByTime(2999);
    expect(results).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(worker.terminated).toBe(true);
    expect(parser.stats.mode).toBe('main-thread');
    expect(results.map((r) => r.kind === 'quotes' && r.quotes[0]?.price)).toEqual([63412.5, 2]);

    parser.parse(frame([btc])); // from now on, inline
    expect(results).toHaveLength(3);
  });

  it('a worker that errors after receiving frames still loses none of them', () => {
    const worker = new DeadWorker();
    const results: ParseOutcome[] = [];
    const parser = createMessageParser({ worker, onResult: (o) => results.push(o) });
    parser.parse(frame([btc]));
    worker.onerror?.(new Error('script failed to load'));
    expect(results).toHaveLength(1);
    expect(parser.stats.mode).toBe('main-thread');
  });

  it('a worker that answers in time is kept', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const parser = createMessageParser({ worker, onResult: () => undefined, workerTimeoutMs: 3000 });
    parser.parse(frame([btc]));
    await Promise.resolve();
    vi.advanceTimersByTime(10_000);
    expect(worker.terminated).toBe(false);
    expect(parser.stats.mode).toBe('worker');
  });
});

describe('worker entry (worker.ts)', () => {
  const scope = globalThis as unknown as {
    onmessage: ((e: { data: WorkerRequest }) => void) | null;
    postMessage?: (m: WorkerResponse) => void;
  };
  afterEach(() => {
    scope.onmessage = null;
    delete scope.postMessage;
  });

  it('parses one frame or a list and posts outcomes back in order', async () => {
    const posted: WorkerResponse[] = [];
    scope.postMessage = (m) => posted.push(m);
    await import('./worker.ts');

    scope.onmessage?.({ data: frame([btc]) });
    scope.onmessage?.({ data: ['{oops', frame([])] });

    expect(posted).toEqual([
      [{ kind: 'quotes', quotes: [btc], rejected: 0 }],
      [
        { kind: 'invalid', error: 'Not valid JSON' },
        { kind: 'quotes', quotes: [], rejected: 0 },
      ],
    ]);
  });
});
