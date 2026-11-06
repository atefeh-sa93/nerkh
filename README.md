# Nerkh

Real-time market dashboard (Global + Iran) in a Turborepo monorepo: Next.js, Lit widget, Storybook, WebSocket with Web Worker, Playwright.

> Work in progress. Tasks are tracked as [issues by day](https://github.com/atefeh-sa93/nerkh/milestones).

## Quick start

Requires Node 22.18+ and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm check        # lint, typecheck and test in every workspace
pnpm format       # Prettier
```

Run the mock price stream (no API keys needed):

```bash
pnpm --filter @nerkh/mock-server dev   # ws://localhost:4000
docker compose up                      # same server in Docker
```

Resource use is capped so checks don't take over a laptop: Turbo runs at most 2 tasks at once (`--concurrency=2`) and Vitest uses at most 2 workers (`@nerkh/config/vitest`). To test one package only: `pnpm --filter @nerkh/data test`.

## Layout

```
apps/        # web (Next.js), widget (Lit), mock-server (Node + ws)
packages/    # config, data, ws-client, ui, persian-kit
docs/adr/    # architecture decision records
```

## Decisions

Why things are built the way they are: [docs/adr](docs/adr/README.md), starting with [001 · why a monorepo](docs/adr/001-monorepo.md).

## Performance

Measured, not assumed ([ADR-002](docs/adr/002-batching-and-worker.md), reproduce with `pnpm --filter @nerkh/web bench`): at ~450 quotes/s arriving one per message, per-frame batching cuts React commits about 7× (456/s → 64/s), holding 60 fps. Render time also drops, though by less than run-to-run noise allows us to state precisely. Parsing in a Web Worker saves about 1 ms of main-thread time per second at these rates; it's kept as insurance and documented as such.

Out of scope by design: trading, user accounts and wallets. Nerkh only displays prices.
