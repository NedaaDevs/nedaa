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
  const msg = d.detail ? `${d.summary}\n${d.detail}` : d.summary;
  if (isHighConfidence(d.kind)) {
    log.e(`native-${d.kind}`, msg);
  } else {
    log.w(`native-${d.kind}`, msg);
  }
};

// Drain OS diagnostics recorded since last launch into the crash log domain. High-confidence
// events (crash/anr) also write the crash sentinel so CrashReportPrompt shows this launch.
// Best-effort: never throws, never blocks launch.
export const processNativeDiagnostics = async (): Promise<void> => {
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
  } catch (error) {
    log.w(
      "native-drain",
      "failed to drain native diagnostics",
      error instanceof Error ? error : undefined
    );
  }
};
