import { parseQuotes, type Quote } from '@nerkh/data';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { parseClientMessage, type ServerMessage } from './protocol.ts';
import { DROP_CLOSE_CODE, startMockServer, type MockServer, type MockServerOptions } from './server.ts';

const servers: MockServer[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function start(options: MockServerOptions = {}): Promise<MockServer> {
  const server = await startMockServer({ port: 0, host: '127.0.0.1', tickMs: 10, ...options });
  servers.push(server);
  return server;
}

/** Connects and records every message; `next(type)` waits for the next message of that type. */
async function connect(url: string) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  const inbox: ServerMessage[] = [];
  const waiters: { type: string; resolve: (m: ServerMessage) => void }[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    const i = waiters.findIndex((w) => w.type === message.type);
    if (i >= 0) waiters.splice(i, 1)[0]?.resolve(message);
    else inbox.push(message);
  });
  await new Promise((resolve, reject) => socket.once('open', resolve).once('error', reject));
  return {
    socket,
    send: (payload: unknown) => socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    next<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
      const i = inbox.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0] as Extract<ServerMessage, { type: T }>);
      return new Promise((resolve) => waiters.push({ type, resolve: resolve as (m: ServerMessage) => void }));
    },
    closed: () => new Promise<number>((resolve) => socket.once('close', (code) => resolve(code))),
  };
}

async function collectQuotes(client: Awaited<ReturnType<typeof connect>>, min: number): Promise<Quote[]> {
  const quotes: Quote[] = [];
  while (quotes.length < min) quotes.push(...(await client.next('quotes')).quotes);
  return quotes;
}

describe('parseClientMessage', () => {
  it('accepts subscribe and unsubscribe', () => {
    expect(parseClientMessage('{"type":"subscribe","symbols":["BTC-EUR"]}')).toEqual({
      ok: true,
      message: { type: 'subscribe', symbols: ['BTC-EUR'] },
    });
    expect(parseClientMessage('{"type":"unsubscribe"}').ok).toBe(true);
  });

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '42'],
    ['unknown type', '{"type":"buy"}'],
    ['symbols not an array', '{"type":"subscribe","symbols":"BTC-EUR"}'],
    ['symbols with numbers', '{"type":"subscribe","symbols":[1]}'],
  ])('rejects %s', (_label, raw) => {
    expect(parseClientMessage(raw).ok).toBe(false);
  });
});

describe('mock server', () => {
  it('streams valid quotes for the subscribed symbols only', async () => {
    const server = await start();
    const client = await connect(server.url);
    client.send({ type: 'subscribe', symbols: ['BTC-EUR', 'USD-IRT', 'NOPE-XYZ'] });

    expect(await client.next('subscribed')).toEqual({ type: 'subscribed', symbols: ['BTC-EUR', 'USD-IRT'] });

    const quotes = await collectQuotes(client, 10);
    expect(parseQuotes(quotes).rejected).toEqual([]);
    expect(new Set(quotes.map((q) => q.symbol))).toEqual(new Set(['BTC-EUR', 'USD-IRT']));
  });

  it('gives every client the same shared market', async () => {
    const server = await start();
    const a = await connect(server.url);
    const b = await connect(server.url);
    a.send({ type: 'subscribe', symbols: ['BTC-EUR'] });
    b.send({ type: 'subscribe', symbols: ['BTC-EUR'] });
    await Promise.all([a.next('subscribed'), b.next('subscribed')]);

    const [fromA, fromB] = await Promise.all([a.next('quotes'), b.next('quotes')]);
    expect(fromA).toEqual(fromB);
  });

  it('stamps quotes with the injected clock (seed determinism is tested in @nerkh/data)', async () => {
    const server = await start({ seed: 7, now: () => 1793866630000 });
    const client = await connect(server.url);
    client.send({ type: 'subscribe', symbols: ['BTC-EUR', 'ETH-EUR', 'USD-IRT'] });
    await client.next('subscribed');
    const quotes = await collectQuotes(client, 3);
    expect(quotes.every((q) => q.updatedAt === 1793866630000)).toBe(true);
  });

  it('stops sending after unsubscribe', async () => {
    const server = await start();
    const client = await connect(server.url);
    client.send({ type: 'subscribe', symbols: ['BTC-EUR'] });
    await client.next('subscribed');
    await client.next('quotes');
    client.send({ type: 'unsubscribe' });
    expect(await client.next('subscribed')).toEqual({ type: 'subscribed', symbols: [] });

    let received = 0;
    client.socket.on('message', (d) => {
      if ((JSON.parse(d.toString()) as ServerMessage).type === 'quotes') received++;
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(received).toBe(0);
  });

  it('answers a bad message with an error and keeps the connection open', async () => {
    const server = await start();
    const client = await connect(server.url);
    client.send('not json');
    expect((await client.next('error')).message).toMatch(/JSON/);
    expect(client.socket.readyState).toBe(WebSocket.OPEN);
  });

  it('drop() closes every client with code 1012', async () => {
    const server = await start();
    const a = await connect(server.url);
    const b = await connect(server.url);
    const codes = Promise.all([a.closed(), b.closed()]);
    expect(server.drop()).toBe(2);
    expect(await codes).toEqual([DROP_CLOSE_CODE, DROP_CLOSE_CODE]);
  });

  it('a client can reconnect after a drop', async () => {
    const server = await start();
    const first = await connect(server.url);
    const closed = first.closed();
    server.drop();
    await closed;

    const again = await connect(server.url);
    again.send({ type: 'subscribe', symbols: ['ETH-EUR'] });
    expect((await again.next('quotes')).quotes[0]?.symbol).toBe('ETH-EUR');
  });

  it('dropEveryMs drops connections on a timer', async () => {
    const server = await start({ dropEveryMs: 50 });
    const client = await connect(server.url);
    expect(await client.closed()).toBe(DROP_CLOSE_CODE);
  });

  it('serves /health and POST /admin/drop over HTTP', async () => {
    const server = await start();
    const base = `http://127.0.0.1:${server.port}`;
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.text()).toBe('ok');

    const client = await connect(server.url);
    const closed = client.closed();
    const res = await fetch(`${base}/admin/drop`, { method: 'POST' });
    expect(await res.json()).toEqual({ dropped: 1 });
    expect(await closed).toBe(DROP_CLOSE_CODE);

    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });
});
