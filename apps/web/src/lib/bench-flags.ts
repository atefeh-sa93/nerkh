/**
 * URL switches for the performance comparison in ADR-002. Normal visitors
 * never set them; the defaults are the real configuration.
 *
 *   ?bench=1           show the measurement panel
 *   ?batching=off      every quote updates the store on its own
 *   ?worker=off        parse WebSocket frames on the main thread
 */
export interface BenchFlags {
  bench: boolean;
  batching: boolean;
  worker: boolean;
}

export const DEFAULT_FLAGS: BenchFlags = { bench: false, batching: true, worker: true };

export function parseBenchFlags(search: string): BenchFlags {
  const params = new URLSearchParams(search);
  return {
    bench: params.get('bench') === '1',
    batching: params.get('batching') !== 'off',
    worker: params.get('worker') !== 'off',
  };
}

/** Short name of the configuration, for result labels. */
export function describeFlags(flags: BenchFlags): string {
  if (flags.batching && flags.worker) return 'batching + worker';
  if (!flags.batching && !flags.worker) return 'no batching, no worker';
  return flags.batching ? 'batching, no worker' : 'no batching, worker';
}
