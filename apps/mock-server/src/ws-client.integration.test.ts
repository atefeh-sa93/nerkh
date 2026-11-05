// End to end: the real ws-client against the real mock server, over real
// sockets. Proves reconnect, resubscribe and the "reconnected" signal work
// together, not just against a fake.
import { createWsClient, type ConnectionStatus } from '@nerkh/ws-client';
import { afterEach, expect, it } from 'vitest';
import { startMockServer, type MockServer } from './server.ts';

let server: MockServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (check()) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        reject(new Error('Timed out'));
      }
    }, 10);
  });
}

it('reconnects after the server drops it, resubscribes and keeps receiving quotes', async () => {
  server = await startMockServer({ port: 0, host: '127.0.0.1', tickMs: 10 });

  const client = createWsClient({
    url: server.url,
    backoff: { initialDelayMs: 50, maxDelayMs: 200 },
  });
  const statuses: ConnectionStatus[] = [];
  const opens: boolean[] = [];
  let quotes = 0;
  client.on('status', ({ status }) => statuses.push(status));
  client.on('open', ({ reconnected }) => opens.push(reconnected));
  client.on('message', (raw) => {
    if ((JSON.parse(raw) as { type: string }).type === 'quotes') quotes++;
  });
  client.setSubscription(JSON.stringify({ type: 'subscribe', symbols: ['BTC-EUR'] }));

  client.connect();
  await waitFor(() => quotes > 0);

  server.drop();
  await waitFor(() => client.status === 'reconnecting');
  const before = quotes;
  await waitFor(() => client.status === 'connected' && quotes > before);

  expect(opens).toEqual([false, true]);
  expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected']);

  client.close();
  expect(client.status).toBe('paused');
});
