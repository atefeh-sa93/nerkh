# 001. One Turborepo + pnpm monorepo for all apps

- Status: Accepted
- Date: 2026-11-05

## Context

Nerkh has three apps that all work with the same prices:

- `apps/web`: the Next.js dashboard (Global and Iran modes)
- `apps/widget`: an embeddable `<price-widget>` built with Lit
- `apps/mock-server`: a Node WebSocket server that streams test data

All three need the same `Quote` type, the same Zod validation, the same mock data, and two of them need the same WebSocket client (reconnect, batching, Web Worker parsing). The dashboard and the widget also share colour tokens, so dark and light themes look the same everywhere.

If each app lived in its own repository, that shared code would be copied three times or published as npm packages after every change. Copies drift; a fix to validation in one place would silently miss the others.

## Decision

One repository with pnpm workspaces and Turborepo:

- `apps/*` for things that run (web, widget, mock-server)
- `packages/*` for shared code (`config`, `data`, `ws-client`, `ui`, `persian-kit`)
- Shared packages are consumed as TypeScript source through `workspace:*` dependencies; there is no publish step
- Turborepo runs `lint`, `typecheck`, `test` and `build` in every workspace, in dependency order, and caches results locally and in CI

Package boundaries are enforced, not just agreed on (see `packages/config/README.md`):

- `packages/*` never import from `apps/*`
- `packages/data` and `packages/ws-client` never import React

## Alternatives considered

- **Separate repositories per app.** Simple per repo, but shared types and the WebSocket client would be copied or versioned and published. Too much overhead for one developer and an 8-day plan, and changes that touch data and UI would need several coordinated PRs.
- **A single Next.js app with folders instead of packages.** Least setup, but the widget must build as a small standalone library and the mock server runs in Docker without Next.js. Folder conventions also cannot stop the data layer from importing React.
- **Nx instead of Turborepo.** More features (generators, project graph UI, module boundary plugin), but heavier to configure for five packages and three apps. Turborepo plus an ESLint rule covers what this project needs.
- **npm or Yarn workspaces instead of pnpm.** pnpm is faster on disk and strict about undeclared dependencies, which catches a package using something it never listed.

## Consequences

Easier:

- One `Quote` type and one validator for every app; a fix lands everywhere in one PR
- A future Expo mobile app or a Vue version of the widget can reuse `data` and `ws-client` unchanged, because they have no React dependency
- One CI workflow checks everything; Turbo's cache skips work that did not change
- Resource use is capped in one place (`--concurrency=2`, Vitest `maxWorkers: 2`)

Harder:

- More configuration up front: workspace files, shared tsconfig and ESLint presets, Turbo task graph
- Every new package needs its own `package.json`, `tsconfig.json`, `eslint.config.js` and `vitest.config.js`
- TypeScript is pinned to the version `typescript-eslint` supports (6.0 today), for all packages at once

We must keep doing:

- Put shared code in `packages/*`, never import across apps
- Pick the right ESLint preset for each new package (`package` or `agnostic`)
