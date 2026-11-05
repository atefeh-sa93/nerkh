import { fileURLToPath } from 'node:url';
import shared from '@nerkh/config/vitest';

export default {
  ...shared,
  resolve: {
    // Same alias as tsconfig "paths".
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
};
