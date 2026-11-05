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

Resource use is capped so checks don't take over a laptop: Turbo runs at most 2 tasks at once (`--concurrency=2`) and Vitest uses at most 2 workers (`@nerkh/config/vitest`). To test one package only: `pnpm --filter @nerkh/data test`.

## Layout

```
apps/        # web (Next.js), widget (Lit), mock-server (Node + ws)
packages/    # config, data, ws-client, ui, persian-kit
docs/adr/    # architecture decision records
```

## Decisions

Why things are built the way they are: [docs/adr](docs/adr/README.md), starting with [001 · why a monorepo](docs/adr/001-monorepo.md).

Out of scope by design: trading, user accounts and wallets. Nerkh only displays prices.
