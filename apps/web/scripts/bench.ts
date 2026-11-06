// Reproducible performance comparison for ADR-002.
//
//   pnpm --filter @nerkh/web bench
//
// Builds the static site with React profiling on, starts the mock WebSocket
// server and a static file server, then opens the dashboard in headless
// Chromium once per configuration with ?bench=1 and collects the numbers the
// in-page probe (src/bench/BenchProbe.tsx) reports. Prints a Markdown table
// and writes docs/benchmarks/latest.json at the repo root.
//
// One browser, one page at a time, so it doesn't saturate the machine.
import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { cpus, platform, totalmem } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockQuoteGenerator } from '@nerkh/data';
import { parseServerMessage } from '@nerkh/ws-client';
import { chromium } from '@playwright/test';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(WEB, '..', '..');
const OUT = join(WEB, 'out');
const WS_PORT = 4517; // baked into the build via NEXT_PUBLIC_WS_URL (see package.json "bench")
const RUNS = Number(process.env.BENCH_RUNS ?? 2);

const CONFIGS = [
  { query: '', label: 'batching + worker' },
  { query: '&batching=off', label: 'no batching' },
  { query: '&worker=off', label: 'no worker' },
];

/**
 * Bundled: a frame every 50 ms carrying several quotes (fewer frames than
 * screen refreshes). One per frame: a frame every 5 ms with about one quote
 * (more frames than refreshes, like many exchange feeds). Stress: 1000
 * quotes/s, one per frame. Batching can only help when frames outnumber refreshes.
 */
const SCENARIOS = [
  { tickMs: 50, rate: 200, label: 'bundled (20 frames/s)' },
  { tickMs: 5, rate: 200, label: 'one quote per frame (~200 frames/s)' },
  { tickMs: 1, rate: 1000, label: 'stress: 1000 quotes/s, one per frame' },
];

interface Result {
  scenario?: string;
  label: string;
  messagesPerSec: number;
  commitsPerSec: number;
  renderMsPerSec: number;
  avgCommitMs: number;
  fps: number;
  slowFramesPerSec: number;
  longTaskMsPerSec: number;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function serveStatic(dir: string): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
    let file = join(dir, path);
    if (!file.startsWith(dir)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: () => server.close(),
      }),
    ),
  );
}

async function startMockServer(tickMs: number, rate: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, [join(ROOT, 'apps/mock-server/src/main.ts')], {
    env: {
      ...process.env,
      PORT: String(WS_PORT),
      HOST: '127.0.0.1',
      SEED: '42',
      RATE: String(rate),
      TICK_MS: String(tickMs),
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${WS_PORT}/health`)).ok) return child;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`Mock server did not start on port ${WS_PORT} (is the port in use?)`);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** What the Worker takes off the main thread: JSON.parse + Zod validation per frame, in Node. */
function measureParseCost(quotesPerFrame: number): { usPerFrame: number } {
  const generator = createMockQuoteGenerator({ seed: 1 });
  const frames = Array.from({ length: 2000 }, () =>
    JSON.stringify({
      type: 'quotes',
      quotes: Array.from({ length: quotesPerFrame }, () => generator.next()),
    }),
  );
  for (const f of frames.slice(0, 200)) parseServerMessage(f); // warm up the JIT
  const start = performance.now();
  for (let round = 0; round < 5; round++) for (const f of frames) parseServerMessage(f);
  return { usPerFrame: Math.round(((performance.now() - start) * 1000) / (frames.length * 5)) };
}

async function main() {
  if (!existsSync(join(OUT, 'index.html')))
    throw new Error('No build in apps/web/out. Run `pnpm --filter @nerkh/web bench`.');

  const site = await serveStatic(OUT);
  const browser = await chromium.launch();
  const results: Result[] = [];

  try {
    for (const scenario of SCENARIOS) {
      const mock = await startMockServer(scenario.tickMs, scenario.rate);
      try {
        for (const config of CONFIGS) {
          const runs: Result[] = [];
          for (let run = 0; run < RUNS; run++) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
            await page.goto(`${site.url}/?bench=1${config.query}`);
            await page.waitForFunction(() => window.__nerkhBench !== undefined, null, { timeout: 30_000 });
            runs.push((await page.evaluate(() => window.__nerkhBench)) as Result);
            await page.close();
            process.stderr.write(`  ${scenario.label} · ${config.label} · run ${run + 1}/${RUNS}\n`);
          }
          // Median of each metric across runs.
          const pick = (k: Exclude<keyof Result, 'label' | 'scenario'>) => median(runs.map((r) => r[k]));
          results.push({
            scenario: scenario.label,
            label: config.label,
            messagesPerSec: pick('messagesPerSec'),
            commitsPerSec: pick('commitsPerSec'),
            renderMsPerSec: pick('renderMsPerSec'),
            avgCommitMs: pick('avgCommitMs'),
            fps: pick('fps'),
            slowFramesPerSec: pick('slowFramesPerSec'),
            longTaskMsPerSec: pick('longTaskMsPerSec'),
          });
        }
      } finally {
        mock.kill();
        await new Promise((r) => setTimeout(r, 300)); // let the port free up
      }
    }
  } finally {
    await browser.close();
    site.close();
  }

  const parse = { bundled: measureParseCost(5), single: measureParseCost(1) };
  const machine = `${platform()} · ${cpus()[0]?.model ?? 'cpu'} × ${cpus().length} · ${Math.round(totalmem() / 2 ** 30)} GB · headless Chromium · ${RUNS} runs each (median)`;
  const header =
    '| Scenario | Configuration | quotes/s | React commits/s | render ms/s | ms/commit | fps | slow frames/s | long-task ms/s |';
  const rows = results.map(
    (r) =>
      `| ${r.scenario} | ${r.label} | ${r.messagesPerSec} | ${r.commitsPerSec} | ${r.renderMsPerSec} | ${r.avgCommitMs} | ${r.fps} | ${r.slowFramesPerSec} | ${r.longTaskMsPerSec} |`,
  );
  process.stdout.write(
    [
      machine,
      '',
      header,
      '|---|---|---|---|---|---|---|---|---|',
      ...rows,
      '',
      `Parse + validate (what the Worker moves off the main thread): ${parse.bundled.usPerFrame} µs per 5-quote frame, ${parse.single.usPerFrame} µs per 1-quote frame (Node, same code).`,
    ].join('\n') + '\n',
  );

  const dir = join(ROOT, 'docs/benchmarks');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'latest.json'),
    JSON.stringify({ date: new Date().toISOString(), machine, results, parse }, null, 2) + '\n',
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
