// Package boundary rules (ADR-001). ESLint does not merge two
// `no-restricted-imports` entries, so each preset below lists every
// restriction it needs in a single rule.

const noAppImports = [
  {
    regex: '^@nerkh/(web|widget|mock-server)(/|$)',
    message: 'Packages must not import from apps. Move shared code into a package instead.',
  },
  {
    regex: '(^|/)apps(/|$)',
    message: 'Packages must not import from apps/*. Move shared code into a package instead.',
  },
];

const noReact = [
  {
    regex: '^(react|react-dom)(/|$)',
    message:
      'This package is framework-agnostic: no React. Expose plain functions or events and adapt them in the app.',
  },
];

/** For every workspace under packages/*: never import from apps/*. */
export const packageBoundaries = {
  rules: {
    'no-restricted-imports': ['error', { patterns: noAppImports }],
  },
};

/** For packages/data and packages/ws-client: no apps/* and no React. */
export const frameworkAgnosticBoundaries = {
  rules: {
    'no-restricted-imports': ['error', { patterns: [...noAppImports, ...noReact] }],
  },
};
