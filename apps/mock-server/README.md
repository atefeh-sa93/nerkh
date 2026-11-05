# @nerkh/mock-server

WebSocket server that streams seeded mock quotes from `@nerkh/data`. Used for local development, E2E tests and `docker compose up`. No API keys, no network.

```bash
pnpm --filter @nerkh/mock-server dev       # ws://localhost:4000, restarts on change
docker compose up                          # from the repo root
```

## Settings (environment variables)

| Variable        | Default   | Meaning                                                   |
| --------------- | --------- | --------------------------------------------------------- |
| `PORT`          | `4000`    | HTTP and WebSocket port                                   |
| `HOST`          | `0.0.0.0` | Interface to listen on                                    |
| `SEED`          | `42`      | Same seed, same market                                    |
| `RATE`          | `200`     | Quotes generated per second across all symbols            |
| `DROP_EVERY_MS` | off       | Close every connection on this interval to test reconnect |

## Protocol (JSON text frames)

Client → server:

```json
{ "type": "subscribe", "symbols": ["BTC-EUR", "USD-IRT"] }
{ "type": "unsubscribe" }
```

Server → client:

```json
{ "type": "subscribed", "symbols": ["BTC-EUR", "USD-IRT"] }
{ "type": "quotes", "quotes": [{ "symbol": "BTC-EUR", "price": 63412.5, "...": "..." }] }
{ "type": "error", "message": "Message is not valid JSON" }
```

Unknown symbols are ignored. A bad message gets an `error` reply; the connection stays open. All clients see the same shared market.

## HTTP

- `GET /health` → `ok`
- `POST /admin/drop` → closes every WebSocket with code `1012`, returns `{ "dropped": n }`. Use it to watch clients reconnect.
