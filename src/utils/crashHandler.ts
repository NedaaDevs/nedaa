import { File, Directory, Paths } from "expo-file-system";

import { AppLogger } from "@/utils/appLogger";
import { appVersionLabel } from "@/utils/appVersion";
import { usePendingReportStore } from "@/stores/pendingReport";

// Sentinel dropped when a fatal JS error is caught, so the next launch can detect the
// crash and offer to share a report (consumed by the report flow).
const sentinelFile = () => new File(new Directory(Paths.document, "logs"), ".pending-report.json");

export interface PendingReport {
  ts: number;
  kind: "crash" | "native-crash" | "anr";
  summary: string;
  /** build that was running when the sentinel was written; absent on sentinels from older builds */
  version?: string;
}

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// A sentinel is worth a prompt only while it still describes the installed build. The native
// drain can write one during a background launch, where no UI exists to show it, so it can sit
// unread until the user next opens the app — weeks later, and often after an update that
// replaced the build the report would have been about. An unstamped sentinel predates this
// field, so it is older than the running build by definition.
export const isPendingReportActionable = (pending: PendingReport): boolean =>
  Date.now() - pending.ts < MAX_AGE_MS && pending.version === appVersionLabel();

const log = AppLogger.create("crash");

// Guards against double-install: a second call would wrap our own handler and
// duplicate every log line, flush, and sentinel write.
let installed = false;

// Install a global JS error handler that records the crash into the `crash` domain,
// force-flushes everything to disk, and writes the sentinel — then chains to the
// previous handler so the dev red-screen / default behavior is preserved.
export const installCrashHandler = (): void => {
  if (installed) return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      log.e(
        isFatal ? "fatal" : "error",
        `${isFatal ? "FATAL " : ""}${error?.message ?? String(error)}`,
        error
      );
      AppLogger.flushAllSync();
      // RN reports guarded, recoverable errors with isFatal=false and keeps running —
      // those are logged above but must not raise the "app crashed" prompt.
      if (isFatal) {
        writePendingReport(`${error?.name ?? "Error"}: ${error?.message ?? String(error)}`);
      }
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

const writeSentinel = (
  kind: PendingReport["kind"],
  summary: string,
  version = appVersionLabel()
): void => {
  try {
    const f = sentinelFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ ts: Date.now(), kind, summary, version } satisfies PendingReport));
    // Wake any mounted CrashReportPrompt: the native drain writes this after the prompt's
    // first read, so a nonce bump makes it re-check within the same session.
    usePendingReportStore.getState().notify();
  } catch {
    // ignore — best-effort
  }
};

const writePendingReport = (summary: string): void => writeSentinel("crash", summary);

// Written by the native-diagnostics drain when an OS-level crash or ANR is found on the
// previous session, so CrashReportPrompt shows on this launch (same sentinel file).
// `version` is the build that died, which the OS reports alongside the event. It can predate
// the running build, because a payload is only delivered on the launch after the death and the
// store may have updated in between. Falls back to the running build when the platform omits it.
export const writeNativePendingReport = (
  kind: "native-crash" | "anr",
  summary: string,
  version?: string
): void => writeSentinel(kind, summary, version ?? appVersionLabel());

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
