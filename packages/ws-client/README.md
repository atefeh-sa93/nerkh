# @nerkh/ws-client

Framework-agnostic WebSocket client: reconnect with exponential backoff and jitter, connection status, manual stop. No React, so the dashboard, the widget and a future mobile app can share it.

```ts
import { createWsClient } from '@nerkh/ws-client';

const client = createWsClient({ url: 'ws://localhost:4000' });

client.setSubscription(JSON.stringify({ type: 'subscribe', symbols: ['BTC-EUR'] })); // re-sent on every reconnect
client.on('status', ({ status, attempt, nextRetryMs }) => render(status));
client.on('message', (raw) => handle(raw));
client.on('open', ({ reconnected }) => {
  if (reconnected) refetchSnapshot(); // fill the gap while we were offline
});

client.connect();
client.close(); // "Pause stream": stays stopped until connect()
```

## Status

| Status         | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| `idle`         | Created, not started                                       |
| `connecting`   | First connection in progress                               |
| `connected`    | Open and receiving                                         |
| `reconnecting` | Lost the connection; `nextRetryMs` says when it tries next |
| `paused`       | Stopped with `close()`; never reconnects on its own        |
| `failed`       | Gave up after `maxRetries`; `connect()` tries again        |

## Backoff

Delay before retry _n_ = `min(maxDelayMs, initialDelayMs × factor^(n−1))`, spread by ±`jitter` so many clients dropped at once don't all return at the same moment. Defaults: 1 s, ×2, capped at 30 s, ±30 %, 10 retries. A successful open resets the count.

Parsing in a Web Worker (#13) and batching per animation frame (#14) build on this client.
