// packages/data runs in the browser, in a Web Worker and in Node, so its
// tsconfig has no DOM or Node types. Timers exist in all three; declare
// only the two this package uses.
declare function setInterval(handler: () => void, ms: number): unknown;
declare function clearInterval(id: unknown): void;
