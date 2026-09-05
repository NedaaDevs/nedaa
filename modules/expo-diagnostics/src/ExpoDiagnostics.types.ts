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
