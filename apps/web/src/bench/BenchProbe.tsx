'use client';

import { Profiler, useEffect, useRef, useState, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { describeFlags, parseBenchFlags } from '@/lib/bench-flags';
import { feedStore } from '@/store/feed';
import { SLOW_FRAME_MS, summarizeSample, type BenchResult, type BenchSample } from './measure';

const WARMUP_MS = 3000;
const MEASURE_MS = 10_000;

declare global {
  interface Window {
    /** Result of the last run, for scripts and copy/paste into ADR-002. */
    __nerkhBench?: BenchResult;
  }
}

function emptySample(): BenchSample {
  return {
    durationMs: 0,
    commits: 0,
    renderMs: 0,
    frames: 0,
    slowFrames: 0,
    longTasks: 0,
    longTaskMs: 0,
    messages: 0,
  };
}

/**
 * Wraps the dashboard. With `?bench=1` it measures for 10 s after a 3 s
 * warm-up (React Profiler, frame times, long tasks, message rate) and shows
 * the result. Without the flag it renders children only. Profiler timings
 * need a profiling build (`next build --profile`) or dev mode.
 */
export function BenchProbe({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ enabled: boolean; phase: string; result?: BenchResult }>({
    enabled: false,
    phase: '',
  });
  const sample = useRef<BenchSample>(emptySample());
  const measuring = useRef(false);

  useEffect(() => {
    const flags = parseBenchFlags(window.location.search);
    if (!flags.bench) return;
    const label = describeFlags(flags);
    let raf = 0;
    let last = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const onFrame = (t: number) => {
      if (measuring.current) {
        sample.current.frames++;
        if (t - last > SLOW_FRAME_MS) sample.current.slowFrames++;
      }
      last = t;
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);

    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        if (!measuring.current) return;
        for (const entry of list.getEntries()) {
          sample.current.longTasks++;
          sample.current.longTaskMs += entry.duration;
        }
      });
      observer.observe({ type: 'longtask', buffered: false });
    } catch {
      // Long Tasks API not supported (non-Chromium): those fields stay 0.
    }

    // Start the measurement after the warm-up; avoid setState directly in the effect body.
    timers.push(setTimeout(() => setState({ enabled: true, phase: `warming up · ${label}` }), 0));
    let start = 0;
    let messagesAtStart = 0;
    const totalMessages = () => feedStore.getState().seconds.reduce((sum, s) => sum + s.messages, 0);
    timers.push(
      setTimeout(() => {
        sample.current = emptySample();
        measuring.current = true;
        start = performance.now();
        messagesAtStart = totalMessages();
        setState({ enabled: true, phase: `measuring ${MEASURE_MS / 1000}s · ${label}` });
      }, WARMUP_MS),
    );
    timers.push(
      setTimeout(() => {
        measuring.current = false;
        sample.current.durationMs = performance.now() - start;
        // The meter records whole seconds; this is accurate to about one second's worth.
        sample.current.messages = totalMessages() - messagesAtStart;
        const result = summarizeSample(label, sample.current);
        window.__nerkhBench = result;
        console.warn('[nerkh bench]', JSON.stringify(result));
        setState({ enabled: true, phase: 'done', result });
      }, WARMUP_MS + MEASURE_MS),
    );

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    if (!measuring.current) return;
    sample.current.commits++;
    sample.current.renderMs += actualDuration;
  };

  if (!state.enabled) return <>{children}</>;

  return (
    <>
      <Profiler id="dashboard" onRender={onRender}>
        {children}
      </Profiler>
      <aside
        aria-label="Benchmark"
        className="fixed end-4 bottom-4 z-50 w-72 rounded-xl border border-border bg-surface p-4 font-mono text-xs shadow-lg"
      >
        <h2 className="m-0 mb-2 text-xs font-semibold">Benchmark · {state.phase}</h2>
        {state.result && (
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(state.result).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted">{key}</dt>
                <dd className="m-0 text-end">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </>
  );
}
