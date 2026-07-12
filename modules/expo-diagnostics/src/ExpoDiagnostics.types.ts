export const NativeDiagnosticKind = {
  CRASH: "crash",
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
  /** full payload JSON when small enough */
  raw?: string;
}
