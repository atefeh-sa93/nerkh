// Regenerates src/tokens/tokens.css and tailwind.css from tokens.ts.
import { writeFileSync } from 'node:fs';
import { generateTailwindCss, generateTokensCss } from '../src/tokens/generate.ts';

const dir = new URL('../src/tokens/', import.meta.url);
writeFileSync(new URL('tokens.css', dir), generateTokensCss());
writeFileSync(new URL('tailwind.css', dir), generateTailwindCss());
console.warn('tokens.css and tailwind.css written');
