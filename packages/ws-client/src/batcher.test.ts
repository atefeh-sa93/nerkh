import type { Quote } from '@nerkh/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuoteBatcher, defaultFrameScheduler, type FrameScheduler } from './batcher.ts';

function quote(symbol: string, price: number, updatedAt = 1000): Quote {
  return {
    symbol,
    name: { en: symbol },
    price,
    currency: 'EUR',
    change24h: null,
    kind: 'stream',
    source: 'test',
    updatedAt,
  };
}

/** Frames only happen when the test calls frame(). */
function manualScheduler() {
  let next: (() => void) | null = null;
  const scheduler: FrameScheduler = {
    request: (cb) => {
      next = cb;
      return 1;
    },
    cancel: () => {
      next = null;
    },
  };
  return {
    scheduler,
    frame: () => {
      const cb = next;
      next = null;
      cb?.();
    },
    get waiting() {
      return next !== null;
    },
  };
}

function setup() {
  const clock = manualScheduler();
  const batches: Quote[][] = [];
  const batcher = createQuoteBatcher({ onFlush: (b) => batches.push(b), scheduler: clock.scheduler });
  return { clock, batches, batcher };
}

describe('createQuoteBatcher', () => {
  it('collects many messages and delivers them once per frame', () => {
    const { clock, batches, batcher } = setup();
    batcher.add([quote('BTC-EUR', 1)]);
    batcher.add([quote('ETH-EUR', 2)]);
    batcher.add([quote('SOL-EUR', 3)]);
    expect(batches).toHaveLength(0);

    clock.frame();
    expect(batches).toHaveLength(1);
    expect(batches[0]?.map((q) => q.symbol)).toEqual(['BTC-EUR', 'ETH-EUR', 'SOL-EUR']);
  });

  it('keeps only the newest quote per symbol within a frame', () => {
    const { clock, batches, batcher } = setup();
    batcher.add([quote('BTC-EUR', 1, 1000), quote('ETH-EUR', 10, 1000)]);
    batcher.add([quote('BTC-EUR', 2, 1001)]);
    batcher.add([quote('BTC-EUR', 3, 1002)]);
    clock.frame();

    expect(batches[0]).toEqual([quote('BTC-EUR', 3, 1002), quote('ETH-EUR', 10, 1000)]);
    expect(batcher.stats).toEqual({ received: 4, coalesced: 2, flushes: 1, lastBatchSize: 2 });
  });

  it('never replaces a newer price with an older one that arrives late', () => {
    const { clock, batches, batcher } = setup();
    batcher.add([quote('BTC-EUR', 5, 2000)]);
    batcher.add([quote('BTC-EUR', 4, 1500)]);
    clock.frame();
    expect(batches[0]).toEqual([quote('BTC-EUR', 5, 2000)]);
  });

  it('schedules one frame at a time and nothing when idle', () => {
    const { clock, batches, batcher } = setup();
    expect(clock.waiting).toBe(false);
    batcher.add([quote('BTC-EUR', 1)]);
    batcher.add([quote('BTC-EUR', 2)]);
    expect(clock.waiting).toBe(true);
    clock.frame();
    expect(clock.waiting).toBe(false);

    clock.frame(); // an empty frame delivers nothing
    expect(batches).toHaveLength(1);

    batcher.add([quote('BTC-EUR', 3)]);
    clock.frame();
    expect(batches).toHaveLength(2);
  });

  it('ignores empty adds', () => {
    const { clock, batcher } = setup();
    batcher.add([]);
    expect(clock.waiting).toBe(false);
  });

  it('flush() delivers immediately and cancels the scheduled frame', () => {
    const { clock, batches, batcher } = setup();
    batcher.add([quote('BTC-EUR', 1)]);
    batcher.flush();
    expect(batches).toHaveLength(1);
    expect(clock.waiting).toBe(false);
  });

  it('stop() drops pending quotes and ignores later ones', () => {
    const { clock, batches, batcher } = setup();
    batcher.add([quote('BTC-EUR', 1)]);
    batcher.stop();
    clock.frame();
    batcher.add([quote('BTC-EUR', 2)]);
    clock.frame();
    expect(batches).toHaveLength(0);
  });

  it('turns 200 messages a second into at most one delivery per frame', () => {
    const { clock, batches, batcher } = setup();
    const symbols = ['BTC-EUR', 'ETH-EUR', 'SOL-EUR', 'USD-IRT', 'EUR-IRT'];
    // 1 second at 60 fps, ~3.3 messages between frames
    let sent = 0;
    for (let f = 0; f < 60; f++) {
      while (sent < Math.round(((f + 1) * 200) / 60)) {
        batcher.add([quote(symbols[sent % symbols.length] as string, sent, 1000 + sent)]);
        sent++;
      }
      clock.frame();
    }
    expect(sent).toBe(200);
    expect(batches).toHaveLength(60);
    expect(batcher.stats.received).toBe(200);
  });
});

describe('defaultFrameScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falls back to a ~16 ms timer when requestAnimationFrame is missing', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    defaultFrameScheduler().request(cb);
    vi.advanceTimersByTime(15);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('uses requestAnimationFrame when the browser has it', () => {
    const raf = vi.fn(() => 7);
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);

    const scheduler = defaultFrameScheduler();
    const handle = scheduler.request(() => undefined);
    scheduler.cancel(handle);
    expect(raf).toHaveBeenCalledOnce();
    expect(caf).toHaveBeenCalledWith(7);
  });
});
