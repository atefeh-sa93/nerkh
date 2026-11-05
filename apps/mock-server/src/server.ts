import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMockQuoteGenerator, MOCK_SYMBOLS, type Quote } from '@nerkh/data';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMessage, type ServerMessage } from './protocol.ts';

/** Close code sent when a disconnect is simulated (1012 = service restart). */
export const DROP_CLOSE_CODE = 1012;

export interface MockServerOptions {
  /** 0 picks a free port (used by tests). Default 4000. */
  port?: number;
  host?: string;
  /** Same seed, same market. Default 42. */
  seed?: number;
  /** Total quotes generated per second across all symbols. Default 200. */
  messagesPerSecond?: number;
  /** Batch interval. Default 50 ms. */
  tickMs?: number;
  /** Drop every connection on this interval to exercise client reconnects. Off by default. */
  dropEveryMs?: number;
  now?: () => number;
}

export interface MockServer {
  port: number;
  /** WebSocket URL, e.g. ws://127.0.0.1:4000 */
  url: string;
  /** Close every client connection now (they may reconnect). Returns how many were closed. */
  drop(): number;
  close(): Promise<void>;
}

const KNOWN = new Set(MOCK_SYMBOLS.map((s) => s.symbol));

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

/**
 * One shared market for all clients: a single seeded generator advances on a
 * timer, and each client gets the quotes for the symbols it subscribed to.
 *
 * HTTP endpoints on the same port:
 *   GET  /health       → 200 "ok"
 *   POST /admin/drop   → closes every WebSocket (simulated outage)
 */
export async function startMockServer(options: MockServerOptions = {}): Promise<MockServer> {
  const {
    port = 4000,
    host = '0.0.0.0',
    seed = 42,
    messagesPerSecond = 200,
    tickMs = 50,
    dropEveryMs,
    now = Date.now,
  } = options;

  const generator = createMockQuoteGenerator({ seed, now });
  const subscriptions = new Map<WebSocket, Set<string>>();

  function drop(): number {
    const sockets = [...subscriptions.keys()];
    for (const socket of sockets) socket.close(DROP_CLOSE_CODE, 'Simulated disconnect');
    return sockets.length;
  }

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    } else if (req.method === 'POST' && req.url === '/admin/drop') {
      const dropped = drop();
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ dropped }));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });

  const wss = new WebSocketServer({ server: http });

  wss.on('connection', (socket) => {
    subscriptions.set(socket, new Set());
    socket.on('close', () => subscriptions.delete(socket));
    socket.on('message', (data, isBinary) => {
      if (isBinary) return send(socket, { type: 'error', message: 'Binary frames are not supported' });
      const parsed = parseClientMessage(data.toString());
      if (!parsed.ok) return send(socket, { type: 'error', message: parsed.error });

      if (parsed.message.type === 'unsubscribe') {
        subscriptions.set(socket, new Set());
        return send(socket, { type: 'subscribed', symbols: [] });
      }
      const symbols = [...new Set(parsed.message.symbols)].filter((s) => KNOWN.has(s));
      subscriptions.set(socket, new Set(symbols));
      send(socket, { type: 'subscribed', symbols });
    });
  });

  // Generate the shared market and fan out per client.
  let carry = 0;
  const perTick = (messagesPerSecond * tickMs) / 1000;
  const ticker = setInterval(() => {
    carry += perTick;
    const count = Math.floor(carry);
    carry -= count;
    const batch: Quote[] = [];
    for (let i = 0; i < count; i++) {
      const quote = generator.next();
      if (quote) batch.push(quote);
    }
    for (const [socket, symbols] of subscriptions) {
      if (symbols.size === 0) continue;
      const quotes = batch.filter((q) => symbols.has(q.symbol));
      if (quotes.length > 0) send(socket, { type: 'quotes', quotes });
    }
  }, tickMs);

  const dropper = dropEveryMs ? setInterval(drop, dropEveryMs) : undefined;

  await new Promise<void>((resolve) => http.listen(port, host, resolve));
  const actualPort = (http.address() as AddressInfo).port;
  const urlHost = host === '0.0.0.0' ? '127.0.0.1' : host;

  return {
    port: actualPort,
    url: `ws://${urlHost}:${actualPort}`,
    drop,
    async close() {
      clearInterval(ticker);
      if (dropper) clearInterval(dropper);
      for (const socket of subscriptions.keys()) socket.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, reject) => http.close((err) => (err ? reject(err) : resolve())));
    },
  };
}
