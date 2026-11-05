import { cssVar, tokenNames, tokens, type Theme } from './tokens.ts';

const HEADER = '/* Generated from tokens.ts by `pnpm --filter @nerkh/ui tokens`. Do not edit by hand. */\n';

function block(selector: string, theme: Theme, indent = ''): string {
  // Lower-case hex and single quotes match Prettier, so the formatted file stays comparable.
  const lines = tokenNames.map((name) => `${indent}  ${cssVar(name)}: ${tokens[theme][name].toLowerCase()};`);
  return `${indent}${selector} {\n${indent}  color-scheme: ${theme};\n${lines.join('\n')}\n${indent}}`;
}

/**
 * Light by default, dark when the OS asks for it, and `data-theme` on any
 * element (usually <html>, or the widget host) overrides both.
 */
export function generateTokensCss(): string {
  return [
    HEADER,
    block(":root,\n[data-theme='light']", 'light'),
    '',
    '@media (prefers-color-scheme: dark) {',
    block(":root:not([data-theme='light'])", 'dark', '  '),
    '}',
    '',
    block("[data-theme='dark']", 'dark'),
    '',
  ].join('\n');
}

/** Tailwind v4 theme: utilities like `bg-surface`, `text-up`, `border-border` read the CSS variables. */
export function generateTailwindCss(): string {
  const lines = tokenNames.map((name) => `  --color-${name}: var(${cssVar(name)});`);
  return `${HEADER}\n@theme inline {\n${lines.join('\n')}\n}\n`;
}
