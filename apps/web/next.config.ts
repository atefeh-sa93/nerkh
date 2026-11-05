import type { NextConfig } from 'next';

// GitHub Pages serves the site under /nerkh/; locally it runs at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const config: NextConfig = {
  // Static HTML export: the public demo needs no server.
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@nerkh/ui', '@nerkh/data', '@nerkh/ws-client'],
  reactStrictMode: true,
  // Don't write an AGENTS.md into the app on every dev start.
  agentRules: false,
};

export default config;
