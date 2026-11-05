# Nerkh

Real-time market dashboard (Global + Iran) in a Turborepo monorepo: Next.js, Lit widget, Storybook, WebSocket with Web Worker, Playwright.

> Work in progress. Tasks are tracked as [issues by day](https://github.com/atefeh-sa93/nerkh/milestones).

## Quick start

Requires Node 22.12+ and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm check        # lint, typecheck and test in every workspace
pnpm format       # Prettier
```

## Layout

```
apps/        # web (Next.js), widget (Lit), mock-server (Node + ws)
packages/    # config, data, ws-client, ui, persian-kit
docs/adr/    # architecture decision records
```

Out of scope by design: trading, user accounts and wallets. Nerkh only displays prices.
