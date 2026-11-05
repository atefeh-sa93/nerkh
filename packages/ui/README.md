# @nerkh/ui

Design tokens, theme helpers and (from Day 4) shared components.

## Colour tokens

`src/tokens/tokens.ts` is the only place colours are defined, with a dark and a light value for each:
`bg`, `surface`, `rail`, `border`, `text`, `muted`, `up`, `down`, `live`, `stale`, `stale-bg`, `focus`.

Two CSS files are generated from it. After changing a colour, run:

```bash
pnpm --filter @nerkh/ui tokens
```

A test fails if the CSS files and `tokens.ts` drift apart.

| File                     | Use                                                                           |
| ------------------------ | ----------------------------------------------------------------------------- |
| `@nerkh/ui/tokens.css`   | CSS variables `--nk-*` (dashboard and widget)                                 |
| `@nerkh/ui/tailwind.css` | Tailwind v4 `@theme`: utilities such as `bg-surface`, `text-up`, `text-stale` |

## Theme

Light by default, dark when the OS prefers dark. `data-theme="dark"` or `"light"` on `<html>` (or the widget host) overrides the OS.

```ts
import { applyTheme, resolveTheme, toggleTheme } from '@nerkh/ui';

applyTheme('dark', document.documentElement); // 'light' | 'dark' | 'system'
```

## Accessibility

Tests check that every text colour has at least 4.5:1 contrast on the backgrounds it is used on, in both themes, and the focus ring at least 3:1.
`up` (blue) and `down` (orange) are told apart by hue, which works for common colour blindness, but they are nearly equal in lightness. So a price change must always show its arrow (▲ / ▼), never colour alone.
