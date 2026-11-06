# Benchmarks

The numbers behind [ADR-002](../adr/002-batching-and-worker.md): what per-frame batching and the parsing Web Worker actually save.

## Run it

```bash
pnpm install
pnpm --filter @nerkh/web exec playwright install chromium   # once, ~100 MB
pnpm --filter @nerkh/web bench
```

It builds the dashboard with React profiling on (`next build --profile`), starts the mock WebSocket server on port 4517 and a static file server, then opens the Global page in headless Chromium for each scenario and configuration. Each run warms up for 3 s and measures for 10 s; each configuration runs twice and the median is reported. Total time is about 3 minutes, one browser page at a time.

Results print as a Markdown table and are written to [`latest.json`](latest.json).

## What is measured

| Metric                                  | Source                                                               |
| --------------------------------------- | -------------------------------------------------------------------- |
| quotes/s                                | the dashboard's own rate meter                                       |
| React commits/s, render ms/s, ms/commit | `<Profiler>` around the page (`onRender` calls and `actualDuration`) |
| fps, slow frames/s                      | a `requestAnimationFrame` loop; a frame over 25 ms counts as slow    |
| long-task ms/s                          | `PerformanceObserver` for `longtask` (main-thread blocks over 50 ms) |
| parse cost                              | `parseServerMessage` (JSON + Zod) timed in Node over 10 000 frames   |

## Try one configuration by hand

With the mock server running and `NEXT_PUBLIC_WS_URL` pointing at it, open the dashboard with:

- `?bench=1`: the real configuration
- `?bench=1&batching=off`: every quote updates the store on its own
- `?bench=1&worker=off`: parse on the main thread

A panel in the corner shows the result after 13 seconds. The window must be visible: hidden tabs pause animation frames, which makes the numbers meaningless.
