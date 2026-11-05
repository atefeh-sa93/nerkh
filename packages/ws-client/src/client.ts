import { backoffDelay, DEFAULT_BACKOFF, type BackoffOptions } from './backoff.ts';

/**
 * - `idle`: created, not started
 * - `connecting`: first connection in progress
 * - `connected`: open and receiving
 * - `reconnecting`: lost the connection, waiting or retrying
 * - `paused`: stopped by the user with close(); never reconnects on its own
 * - `failed`: gave up after maxRetries; call connect() to try again
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'failed';

export interface StatusInfo {
  status: ConnectionStatus;
  /** Failed attempts in a row (0 while connected). */
  attempt: number;
  /** When reconnecting: how long until the next try. */
  nextRetryMs?: number;
}

/** The part of a WebSocket the client uses; browser WebSocket and `ws` both fit. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: { code: number; reason?: string }) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

const OPEN = 1;

export interface WsClientOptions {
  url: string;
  backoff?: Partial<BackoffOptions>;
  /** Defaults to the global WebSocket. Inject a fake in tests or `ws` in Node. */
  createSocket?: (url: string) => SocketLike;
  /** Source of randomness for jitter. Default Math.random. */
  random?: () => number;
}

interface Events {
  status: (info: StatusInfo) => void;
  /** Raw text frame. Parsing and validation happen elsewhere (Worker, #13). */
  message: (data: string) => void;
  /** `reconnected` is true when this open follows a lost connection: refetch what was missed. */
  open: (info: { reconnected: boolean }) => void;
}

export interface WsClient {
  readonly status: ConnectionStatus;
  /** Start, or restart after close() or failure. */
  connect(): void;
  /** Stop and stay stopped: no reconnects until connect() is called. */
  close(): void;
  /** Send now if open. Returns false when not connected (nothing is queued). */
  send(data: string): boolean;
  /**
   * A message sent on every (re)connect, e.g. the symbol subscription.
   * Sent immediately when already connected. `null` clears it.
   */
  setSubscription(data: string | null): void;
  on<E extends keyof Events>(event: E, handler: Events[E]): () => void;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const backoff: BackoffOptions = { ...DEFAULT_BACKOFF, ...options.backoff };
  const random = options.random ?? Math.random;
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);

  const handlers: { [E in keyof Events]: Set<Events[E]> } = {
    status: new Set(),
    message: new Set(),
    open: new Set(),
  };

  let status: ConnectionStatus = 'idle';
  let socket: SocketLike | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let subscription: string | null = null;
  let hasConnectedBefore = false;

  function setStatus(next: ConnectionStatus, nextRetryMs?: number): void {
    status = next;
    const info: StatusInfo = { status, attempt, ...(nextRetryMs === undefined ? {} : { nextRetryMs }) };
    for (const h of handlers.status) h(info);
  }

  function detach(s: SocketLike): void {
    s.onopen = s.onclose = s.onmessage = s.onerror = null;
  }

  function scheduleRetry(): void {
    attempt += 1;
    if (attempt > backoff.maxRetries) {
      setStatus('failed');
      return;
    }
    const delay = backoffDelay(attempt, backoff, random);
    setStatus('reconnecting', delay);
    retryTimer = setTimeout(open, delay);
  }

  function open(): void {
    retryTimer = undefined;
    let s: SocketLike;
    try {
      s = createSocket(options.url);
    } catch {
      scheduleRetry();
      return;
    }
    socket = s;

    s.onopen = () => {
      const reconnected = hasConnectedBefore;
      hasConnectedBefore = true;
      attempt = 0;
      setStatus('connected');
      if (subscription !== null) s.send(subscription);
      for (const h of handlers.open) h({ reconnected });
    };
    s.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      for (const h of handlers.message) h(event.data);
    };
    s.onclose = () => {
      detach(s);
      socket = null;
      scheduleRetry();
    };
    // An error is always followed by close, which handles the retry.
    s.onerror = () => undefined;
  }

  return {
    get status() {
      return status;
    },

    connect() {
      if (status === 'connecting' || status === 'connected' || status === 'reconnecting') return;
      attempt = 0;
      setStatus(hasConnectedBefore ? 'reconnecting' : 'connecting');
      open();
    },

    close() {
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      retryTimer = undefined;
      if (socket) {
        const s = socket;
        socket = null;
        detach(s);
        s.close(1000, 'Closed by client');
      }
      attempt = 0;
      setStatus('paused');
    },

    send(data) {
      if (!socket || socket.readyState !== OPEN) return false;
      socket.send(data);
      return true;
    },

    setSubscription(data) {
      subscription = data;
      if (data !== null && socket && socket.readyState === OPEN) socket.send(data);
    },

    on(event, handler) {
      const set = handlers[event] as Set<typeof handler>;
      set.add(handler);
      return () => set.delete(handler);
    },
  };
}
