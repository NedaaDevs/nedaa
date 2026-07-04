import { AppState, AppStateStatus } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import * as Application from "expo-application";

import { AppLogger } from "@/utils/appLogger";
import { readPendingReport } from "@/utils/crashHandler";

// Lifecycle breadcrumbs for diagnostic bundles: launch, foreground/background
// transitions, and version updates go to the `app` domain — the timeline that
// anchors every other domain's entries.
//
// Unclean-exit detection: a small state file records whether the app was last seen
// foreground or background. Finding "active" at launch means the previous session
// died in the foreground without the JS crash handler firing — a native crash, OOM
// kill, or force kill. Logged as a WARN in the `crash` domain (no user prompt:
// force kills and battery deaths make it too false-positive-prone to alarm on).

const appLog = AppLogger.create("app");
const crashLog = AppLogger.create("crash");

type SessionState = {
  state: "active" | "background";
  version: string;
};

const stateFile = () => new File(new Directory(Paths.document, "logs"), ".session-state.json");

const readSessionState = (): SessionState | null => {
  try {
    const f = stateFile();
    return f.exists ? (JSON.parse(f.textSync()) as SessionState) : null;
  } catch {
    return null;
  }
};

const writeSessionState = (state: SessionState["state"], version: string): void => {
  try {
    const dir = new Directory(Paths.document, "logs");
    if (!dir.exists) dir.create({ intermediates: true });
    const f = stateFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ state, version } satisfies SessionState));
  } catch {
    // best-effort — breadcrumbs must never break startup
  }
};

let installed = false;

export const installLifecycleLogging = (): void => {
  if (installed) return;
  installed = true;

  const version = `${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"})`;
  const previous = readSessionState();

  // Previous session ended while foreground with no JS crash sentinel → the JS
  // handler never saw it die (native crash / OOM / force kill).
  if (previous?.state === "active" && !readPendingReport()) {
    crashLog.w(
      "Session",
      `previous session (${previous.version}) ended while foreground without a JS crash — native crash, OOM, or force kill`
    );
  }
  if (previous && previous.version !== version) {
    appLog.i("Session", `updated ${previous.version} -> ${version}`);
  }
  appLog.i("Session", "launched");
  writeSessionState("active", version);

  AppState.addEventListener("change", (next: AppStateStatus) => {
    // `inactive` fires on every iOS control-center/app-switcher peek — noise.
    if (next === "background" || next === "active") {
      appLog.i("State", next);
      writeSessionState(next, version);
    }
  });
};
