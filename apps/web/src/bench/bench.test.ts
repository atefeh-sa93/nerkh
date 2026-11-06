import { describe, expect, it } from 'vitest';
import { describeFlags, parseBenchFlags } from '@/lib/bench-flags';
import { summarizeSample } from './measure';

describe('parseBenchFlags', () => {
  it('defaults to the real configuration', () => {
    expect(parseBenchFlags('')).toEqual({ bench: false, batching: true, worker: true });
  });

  it('reads the switches', () => {
    expect(parseBenchFlags('?bench=1&batching=off&worker=off')).toEqual({
      bench: true,
      batching: false,
      worker: false,
    });
    expect(parseBenchFlags('?batching=on&worker=yes').batching).toBe(true);
  });

  it('labels each configuration', () => {
    expect(describeFlags(parseBenchFlags(''))).toBe('batching + worker');
    expect(describeFlags(parseBenchFlags('?batching=off'))).toBe('no batching, worker');
    expect(describeFlags(parseBenchFlags('?worker=off'))).toBe('batching, no worker');
  });
});

describe('summarizeSample', () => {
  it('turns counters into per-second rates', () => {
    expect(
      summarizeSample('x', {
        durationMs: 10_000,
        commits: 600,
        renderMs: 300,
        frames: 600,
        slowFrames: 5,
        longTasks: 2,
        longTaskMs: 120,
        messages: 2000,
      }),
    ).toEqual({
      label: 'x',
      seconds: 10,
      messagesPerSec: 200,
      commitsPerSec: 60,
      renderMsPerSec: 30,
      avgCommitMs: 0.5,
      fps: 60,
      slowFramesPerSec: 0.5,
      longTaskMsPerSec: 12,
    });
  });
});
