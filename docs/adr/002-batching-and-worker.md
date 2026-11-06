# 002. Batch store updates per animation frame; parse in a Web Worker

- Status: Accepted
- Date: 2026-11-06

## Context

The dashboard receives a stream of price quotes over a WebSocket: about 200 a second from the mock server, more from a busy exchange. Every quote has to be parsed (JSON), validated (Zod) and written to the store, and the table, chart and order book re-render from the store.

Two questions:

1. **Should every quote update the store as it arrives?** Each store update can trigger a React commit. The screen only refreshes about 60 times a second, so commits beyond that are work nobody sees.
2. **Should parsing and validation run on the main thread?** That's where React renders and the browser handles input.

We decided to measure instead of assume (see the benchmark below), and to say so plainly if a technique doesn't pay for itself.

## Decision

- **Batching: yes.** Quotes go to `createQuoteBatcher` (`packages/ws-client`), which keeps only the newest quote per symbol and hands them to the store once per `requestAnimationFrame`. Store updates are capped at the frame rate, whatever the input rate.
- **Web Worker: kept, as insurance, not as a measured win.** Frames are parsed and validated in a Worker (`createMessageParser`). If the Worker fails to load or answer, parsing falls back to the main thread without losing frames. On the hardware we measured, the Worker saves about 1 ms of main-thread time per second or less, so it doesn't change the user experience there. We keep it because it costs little now that it works, and it protects slower devices and much larger messages. If it ever causes trouble again, removing it is a one-line change (`worker: null`).

## Measurements

`pnpm --filter @nerkh/web bench` builds the site with React profiling on, runs the mock server, opens the dashboard in headless Chromium with `?bench=1` (plus `&batching=off` or `&worker=off`), and measures for 10 s after a 3 s warm-up, twice per configuration (median). The script and probe are in `apps/web/scripts/bench.ts` and `apps/web/src/bench/`. The raw output is in [`docs/benchmarks/latest.json`](../benchmarks/latest.json).

Apple M2 (8 cores, 8 GB), headless Chromium (Playwright 1.64.1), Global page (9 symbols), 2026-11-06:

| Scenario                                              | Configuration     | quotes/s | React commits/s | render ms/s | fps | slow frames/s | long tasks |
| ----------------------------------------------------- | ----------------- | -------- | --------------- | ----------- | --- | ------------- | ---------- |
| Bundled: 20 frames/s, ~5 quotes each                  | batching + worker | 105      | 24.5            | 17.2        | 60  | 0.1           | 0          |
|                                                       | no batching       | 102      | 24.1            | 16.9        | 60  | 0             | 0          |
|                                                       | no worker         | 106      | 23.9            | 13.6        | 60  | 0             | 0          |
| One quote per frame (~100 frames/s for these symbols) | batching + worker | 95       | 59.6            | 14.6        | 60  | 0             | 0          |
|                                                       | no batching       | 93       | **97.5**        | 12.1        | 60  | 0             | 0          |
|                                                       | no worker         | 92       | 57.0            | 13.2        | 60  | 0             | 0          |
| Stress: ~450 quotes/s, one per frame                  | batching + worker | 451      | **64.3**        | 28.2        | 60  | 0             | 0          |
|                                                       | no batching       | 452      | **456.1**       | 33.2        | 60  | 0.1           | 0          |
|                                                       | no worker         | 460      | 64.1            | 22.9        | 60  | 0.1           | 0          |

Parse + validate cost (what the Worker moves off the main thread), measured in Node with the same code: about 2 µs per 1-quote frame and 10 µs per 5-quote frame. At 450 frames a second that is about 1 ms per second.

**Run-to-run noise.** Commit counts repeat closely between runs. Render time (ms/s) does not: the same configuration moves by several ms/s between runs. An earlier run of the same script measured stress render time at 24.6 ms/s with batching and 35.8 without (−31 %); this run measured 28.2 and 33.2 (−15 %). Treat render-time differences of a few ms/s as noise.

## What the numbers say

- **When messages already arrive in bundles (fewer than 60 a second), batching changes nothing.** React already merges the store updates triggered while handling one message into a single commit, so commits per second equal messages per second either way (~24).
- **When messages outnumber screen refreshes, batching caps commits at the frame rate.** One quote per message: 98 → 60 commits/s. Under stress: **456 → 64 commits/s**, about 7× fewer, consistently across runs. Render time also went down under stress (by 15–31 % across two runs), but that difference sits close to the noise. The solid result is the commit count: without batching, work grows with the input rate; with it, work grows with the screen.
- **No configuration dropped frames on an M2.** Every run held 60 fps, with at most 0.1 slow frames a second and no long tasks. On this machine the dashboard would feel the same without either technique at these rates. The benefit of batching is headroom: bounded work under bursts and on slower hardware.
- **The Worker's effect is within run-to-run noise.** With the Worker off, render time was sometimes lower and sometimes higher. The parse cost it moves is about 1 ms a second at the highest rate.

## Alternatives considered

- **Throttle by time (e.g. every 100 ms) instead of per frame.** Fewer commits, but visibly laggy prices and unrelated to when the browser actually paints. `requestAnimationFrame` also pauses in hidden tabs for free.
- **`React.startTransition` / `useDeferredValue` instead of batching.** Helps keep input responsive, but React still does the work for every update; it doesn't reduce commits.
- **No Worker, parse inline.** Simpler, and the measurements say it would be fine here. Rejected only because the Worker already works, falls back safely, and keeps the door open for heavier payloads (order books, many symbols) without revisiting the architecture.

## Consequences

- Prices on screen are at most one frame (~16 ms) behind the socket.
- Within a frame only the newest quote per symbol survives; intermediate prices are not drawn (the chart keeps one point per second anyway).
- The batcher and parser are covered by unit tests, an end-to-end pipeline test, and this benchmark. Re-run `pnpm --filter @nerkh/web bench` after changes to the data path and update this ADR if the numbers move.
- Measurements come from one fast machine. Numbers from a slower laptop or phone would make a useful addition.
