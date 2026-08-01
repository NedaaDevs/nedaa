import { useEffect } from "react";

import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";

// Services
import { appSetup } from "@/services/setup";
import { PrayerTimesDB } from "@/services/db";
import { QadaDB } from "@/services/qada-db";
import { AppLogger } from "@/utils/appLogger";
import { installCrashHandler } from "@/utils/crashHandler";
import { installLifecycleLogging } from "@/utils/appLifecycle";
import { processNativeDiagnostics } from "@/utils/nativeDiagnostics";

// Screenshot mode
import { seedScreenshotState } from "@/screenshot-mode/seedScreenshotState";

const initDB = async () => {
  await PrayerTimesDB.initialize();
  await QadaDB.initialize();
};

export const useInitialSetup = () => {
  const appStore = useAppStore();
  const notificationStore = useNotificationStore();
  const prayerTimesStore = usePrayerTimesStore();
  const customSoundsStore = useCustomSoundsStore();

  useEffect(() => {
    // Diagnostics cover first-run/onboarding sessions too — a crash during onboarding
    // must be captured, so these install before the first-run gate. All three are
    // idempotent for the re-run when isFirstRun flips.
    installCrashHandler();
    installLifecycleLogging();
    AppLogger.prune();
    // Drain OS-level diagnostics from the previous session into the crash log (best-effort).
    void processNativeDiagnostics();

    if (!IS_SCREENSHOT_MODE && appStore.isFirstRun) return;

    const initializeApp = async () => {
      if (IS_SCREENSHOT_MODE) {
        seedScreenshotState();
      }
      await initDB();

      await customSoundsStore.initialize();

      await appSetup(prayerTimesStore, notificationStore);
    };

    initializeApp().catch((error) => {
      AppLogger.create("crash").e(
        "Startup",
        "app initialization failed",
        error instanceof Error ? error : undefined
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStore.isFirstRun]);
};
