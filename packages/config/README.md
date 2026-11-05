# @nerkh/config

Shared config for every workspace in the monorepo.

| Export                                | Use it in                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `@nerkh/config/tsconfig/base.json`    | Node scripts, `packages/data`                                              |
| `@nerkh/config/tsconfig/library.json` | Packages that run in the browser or a Worker (`ws-client`, `ui`, `widget`) |
| `@nerkh/config/tsconfig/react.json`   | React code (`apps/web`, `packages/ui`)                                     |
| `@nerkh/config/eslint`                | Apps (`apps/web`, `apps/widget`, `apps/mock-server`)                       |
| `@nerkh/config/eslint/package`        | Packages (`packages/ui`, `packages/persian-kit`)                           |
| `@nerkh/config/eslint/agnostic`       | Framework-agnostic packages (`packages/data`, `packages/ws-client`)        |
| `@nerkh/config/prettier`              | Root `prettier.config.mjs`                                                 |

```jsonc
// tsconfig.json
{ "extends": "@nerkh/config/tsconfig/library.json", "include": ["src"] }
```

```js
// eslint.config.js in packages/data
export { default } from '@nerkh/config/eslint/agnostic';
```

## Package boundaries

Enforced with `no-restricted-imports`, so `pnpm lint` fails on a wrong import:

- `packages/*` never import from `apps/*` (by path or by `@nerkh/web`, `@nerkh/widget`, `@nerkh/mock-server`).
- `packages/data` and `packages/ws-client` never import `react` or `react-dom`.

This keeps the data layer reusable by a future mobile app or a Vue version of the widget.

TypeScript is pinned to 6.0 because `typescript-eslint` does not support 7.x yet.
