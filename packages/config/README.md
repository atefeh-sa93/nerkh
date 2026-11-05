# @nerkh/config

Shared config for every workspace in the monorepo.

| Export                                | Use it in                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `@nerkh/config/tsconfig/base.json`    | Node scripts, `packages/data`                                              |
| `@nerkh/config/tsconfig/library.json` | Packages that run in the browser or a Worker (`ws-client`, `ui`, `widget`) |
| `@nerkh/config/tsconfig/react.json`   | React code (`apps/web`, `packages/ui`)                                     |
| `@nerkh/config/eslint`                | `eslint.config.js` in each workspace                                       |
| `@nerkh/config/prettier`              | Root `prettier.config.mjs`                                                 |

```jsonc
// tsconfig.json
{ "extends": "@nerkh/config/tsconfig/library.json", "include": ["src"] }
```

```js
// eslint.config.js
export { default } from '@nerkh/config/eslint';
```

TypeScript is pinned to 6.0 because `typescript-eslint` does not support 7.x yet.
