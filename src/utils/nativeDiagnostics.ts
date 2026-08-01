import {
  ExpoDiagnosticsModule,
  NativeDiagnosticKind,
  type NativeDiagnostic,
} from "../../modules/expo-diagnostics/src";

import { AppLogger } from "@/utils/appLogger";
import { writeNativePendingReport } from "@/utils/crashHandler";

const log = AppLogger.create("crash");

const isHighConfidence = (kind: NativeDiagnostic["kind"]): boolean =>
  kind === NativeDiagnosticKind.CRASH || kind === NativeDiagnosticKind.ANR;

const logEntry = (d: NativeDiagnostic): void => {
  // The entry's own event time — the log line is written at next-launch drain time,
  // which can be hours or days later.
  const when = Number.isFinite(d.timestamp) ? new Date(d.timestamp).toISOString() : "unknown-time";
  const body = d.detail ? `${d.summary}\n${d.detail}` : d.summary;
  const msg = `[at ${when}] ${body}`;
  if (isHighConfidence(d.kind)) {
    log.e(`native-${d.kind}`, msg);
  } else {
    log.w(`native-${d.kind}`, msg);
  }
};

// Drain OS diagnostics recorded since last launch into the crash log domain. High-confidence
// events (crash/anr) also write the crash sentinel so CrashReportPrompt shows this launch.
// Entries are acknowledged to the native side only after the log write is flushed to disk —
// un-acked records replay on the next drain rather than being lost.
// Best-effort: never throws, never blocks launch.
// Once per session: a second drain before the first ack lands would replay the same
// records and duplicate their log entries.
let drained = false;

export const processNativeDiagnostics = async (): Promise<void> => {
  if (drained) return;
  drained = true;
  try {
    const entries = await ExpoDiagnosticsModule.drain();
    if (entries.length === 0) return;

    for (const entry of entries) {
      logEntry(entry);
    }

    const worst = entries.find((e) => isHighConfidence(e.kind));
    if (worst) {
      const kind = worst.kind === NativeDiagnosticKind.ANR ? "anr" : "native-crash";
      writeNativePendingReport(kind, worst.summary);
    }

    AppLogger.flushAllSync();
    const tokens = entries.map((e) => e.ackToken).filter((t): t is string => Boolean(t));
    if (tokens.length > 0) await ExpoDiagnosticsModule.ack(tokens);
  } catch (error) {
    log.w(
      "native-drain",
      `failed to drain native diagnostics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
