// Entry point: `node src/main.ts` (Node 22.18+ runs TypeScript directly).
import { startMockServer } from './server.ts';

function intFromEnv(name: string, fallback?: number): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  return value;
}

const server = await startMockServer({
  port: intFromEnv('PORT', 4000),
  host: process.env.HOST ?? '0.0.0.0',
  seed: intFromEnv('SEED', 42),
  messagesPerSecond: intFromEnv('RATE', 200),
  dropEveryMs: intFromEnv('DROP_EVERY_MS'),
});

console.warn(`mock-server streaming on ${server.url} (GET /health, POST /admin/drop)`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
