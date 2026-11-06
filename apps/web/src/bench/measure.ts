/** Raw counters collected during one measurement window. */
export interface BenchSample {
  durationMs: number;
  /** React commits of the dashboard tree (Profiler onRender calls). */
  commits: number;
  /** Sum of Profiler actualDuration: time React spent rendering. */
  renderMs: number;
  /** Animation frames seen. */
  frames: number;
  /** Frames that took longer than SLOW_FRAME_MS (visible stutter at 60 Hz). */
  slowFrames: number;
  /** Long tasks (>50 ms main-thread blocks) and their total time. */
  longTasks: number;
  longTaskMs: number;
  /** Quotes received, from the feed meter. */
  messages: number;
}

export const SLOW_FRAME_MS = 25;

export interface BenchResult {
  label: string;
  seconds: number;
  messagesPerSec: number;
  commitsPerSec: number;
  renderMsPerSec: number;
  avgCommitMs: number;
  fps: number;
  slowFramesPerSec: number;
  longTaskMsPerSec: number;
}

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Per-second rates, so runs of slightly different length compare fairly. */
export function summarizeSample(label: string, s: BenchSample): BenchResult {
  const sec = s.durationMs / 1000 || 1;
  return {
    label,
    seconds: round(sec),
    messagesPerSec: round(s.messages / sec, 0),
    commitsPerSec: round(s.commits / sec),
    renderMsPerSec: round(s.renderMs / sec),
    avgCommitMs: s.commits ? round(s.renderMs / s.commits, 2) : 0,
    fps: round(s.frames / sec),
    slowFramesPerSec: round(s.slowFrames / sec, 2),
    longTaskMsPerSec: round(s.longTaskMs / sec),
  };
}
