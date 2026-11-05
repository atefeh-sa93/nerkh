import base from '@nerkh/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  { ignores: ['next-env.d.ts', 'out/**', '.next/**'] },
  reactHooks.configs.flat['recommended-latest'],
];
