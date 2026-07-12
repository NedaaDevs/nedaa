import { File, Directory, Paths } from "expo-file-system";

import { AppLogger } from "@/utils/appLogger";

// Sentinel dropped when a fatal JS error is caught, so the next launch can detect the
// crash and offer to share a report (consumed by the report flow).
const sentinelFile = () => new File(new Directory(Paths.document, "logs"), ".pending-report.json");

export interface PendingReport {
  ts: number;
  kind: "crash" | "native-crash" | "anr";
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
  installRejectionTracker();
};

// Record unhandled promise rejections — ErrorUtils only sees sync fatals, so without
// this, failed async work (DB, downloads, scheduling) vanishes in production.
// Production-only: dev keeps RN's built-in tracker and its LogBox warning.
const installRejectionTracker = (): void => {
  if (__DEV__) return;
  const onUnhandled = (_id: number, rejection: unknown) => {
    try {
      const err = rejection instanceof Error ? rejection : undefined;
      log.e("unhandled-rejection", err?.message ?? String(rejection), err);
      AppLogger.flushAllSync();
    } catch {
      // never throw from the tracker
    }
  };
  try {
    // Hermes has a native tracker; the promise-polyfill path covers other engines.
    const hermes = (
      globalThis as { HermesInternal?: { enablePromiseRejectionTracker?: (o: object) => void } }
    ).HermesInternal;
    if (hermes?.enablePromiseRejectionTracker) {
      hermes.enablePromiseRejectionTracker({ allRejections: true, onUnhandled });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("promise/setimmediate/rejection-tracking").enable({
        allRejections: true,
        onUnhandled,
      });
    }
  } catch {
    // tracker is best-effort
  }
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

// Written by the native-diagnostics drain when an OS-level crash or ANR is found on the
// previous session, so CrashReportPrompt shows on this launch (same sentinel file).
export const writeNativePendingReport = (kind: "native-crash" | "anr", summary: string): void => {
  try {
    const f = sentinelFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ ts: Date.now(), kind, summary } satisfies PendingReport));
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
