export const NativeDiagnosticKind = {
  CRASH: "crash",
  /** SIGKILL with no termination reason: the OS reclaimed the process, not an app fault */
  KILLED: "killed",
  ANR: "anr",
  HANG: "hang",
  MEMORY: "memory",
  OTHER: "other",
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type NativeDiagnosticKind = (typeof NativeDiagnosticKind)[keyof typeof NativeDiagnosticKind];

export interface NativeDiagnostic {
  id: string;
  kind: NativeDiagnosticKind;
  /** epoch ms of the underlying event/exit */
  timestamp: number;
  /** one-line human-readable reason / exception type + codes */
  summary: string;
  /** stack or trace excerpt, truncated natively */
  detail?: string;
  /** opaque token to pass to ack() once the entry has been durably persisted */
  ackToken?: string;
  /** build that was running when the event happened, which may predate the build that drains it */
  appVersion?: string;
}

/** Counts of the WorkManager entries filed under the background-task unique work name. */
export interface BackgroundWorkerQueueCounts {
  uniqueName: string;
  /** every entry the name matched, finished ones included */
  total: number;
  /** entries still to run: the live queue depth */
  unfinished: number;
  enqueued: number;
  running: number;
  /** appended behind a running head, so these run in order rather than together */
  blocked: number;
  /** finished states are pruned after about a day, so these describe a recent window */
  succeeded: number;
  failed: number;
  cancelled: number;
  maxRunAttemptCount: number;
}

/**
 * A queue reading, or the reason there isn't one. "unsupported" and "error" are distinct from
 * a zero count on purpose: a platform without WorkManager must never render as an empty queue.
 */
export type BackgroundWorkerQueueResult =
  | { status: "ok"; counts: BackgroundWorkerQueueCounts }
  | { status: "unsupported" }
  | { status: "error"; message: string };
