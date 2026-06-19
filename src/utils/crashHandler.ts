import { File, Directory, Paths } from "expo-file-system";

import { AppLogger } from "@/utils/appLogger";

// Sentinel dropped when a fatal JS error is caught, so the next launch can detect the
// crash and offer to share a report (consumed by the report flow).
const sentinelFile = () => new File(new Directory(Paths.document, "logs"), ".pending-report.json");

export interface PendingReport {
  ts: number;
  kind: "crash";
  summary: string;
}

const log = AppLogger.create("crash");

// Install a global JS error handler that records the crash into the `crash` domain,
// force-flushes everything to disk, and writes the sentinel — then chains to the
// previous handler so the dev red-screen / default behavior is preserved.
export const installCrashHandler = (): void => {
  const previous = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      log.e("fatal", `${isFatal ? "FATAL " : ""}${error?.message ?? String(error)}`, error);
      AppLogger.flushAllSync();
      writePendingReport(`${error?.name ?? "Error"}: ${error?.message ?? String(error)}`);
    } catch {
      // never let the crash handler throw
    }
    previous?.(error, isFatal);
  });
};

const writePendingReport = (summary: string): void => {
  try {
    const f = sentinelFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ ts: Date.now(), kind: "crash", summary } satisfies PendingReport));
  } catch {
    // ignore — best-effort
  }
};

export const readPendingReport = (): PendingReport | null => {
  try {
    const f = sentinelFile();
    return f.exists ? (JSON.parse(f.textSync()) as PendingReport) : null;
  } catch {
    return null;
  }
};

export const clearPendingReport = (): void => {
  try {
    const f = sentinelFile();
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
};
