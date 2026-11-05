// Shared Vitest config. Capped workers so tests never take over a laptop;
// override locally with `vitest --maxWorkers=<n>` if you have the headroom.
export default {
  test: {
    maxWorkers: 2,
  },
};
