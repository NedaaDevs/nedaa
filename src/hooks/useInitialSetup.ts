import { useEffect } from "react";

import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";

// Services
import { appSetup } from "@/services/setup";
import { initDatabases } from "@/services/databases";
import { AppLogger } from "@/utils/appLogger";
import { installCrashHandler } from "@/utils/crashHandler";
import { installLifecycleLogging } from "@/utils/appLifecycle";
import { processNativeDiagnostics } from "@/utils/nativeDiagnostics";

// Screenshot mode
import { seedScreenshotState } from "@/screenshot-mode/seedScreenshotState";

export const useInitialSetup = () => {
  const isFirstRun = useAppStore((state) => state.isFirstRun);

  useEffect(() => {
    // Diagnostics cover first-run/onboarding sessions too — a crash during onboarding
    // must be captured, so these install before the first-run gate. All three are
    // idempotent for the re-run when isFirstRun flips.
    installCrashHandler();
    installLifecycleLogging();
    AppLogger.prune();
    // Drain OS-level diagnostics from the previous session into the crash log (best-effort).
    void processNativeDiagnostics();

    if (!IS_SCREENSHOT_MODE && isFirstRun) return;

    const initializeApp = async () => {
      if (IS_SCREENSHOT_MODE) {
        seedScreenshotState();
      }
      await initDatabases();

      await useCustomSoundsStore.getState().initialize();

      await appSetup(usePrayerTimesStore.getState(), useNotificationStore.getState());
    };

    initializeApp().catch((error) => {
      AppLogger.create("crash").e(
        "Startup",
        "app initialization failed",
        error instanceof Error ? error : undefined
      );
    });
  }, [isFirstRun]);
};
