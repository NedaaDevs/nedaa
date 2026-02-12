import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";

// Services
import { appSetup } from "@/services/setup";
import { PrayerTimesDB } from "@/services/db";
import { QadaDB } from "@/services/qada-db";

const initSentry = (consent: boolean) => {
  if (!__DEV__ && consent) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      enabled: !__DEV__,
    });
  }
};

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
    if (appStore.isFirstRun) return;

    const initializeApp = async () => {
      initSentry(appStore.sendCrashLogs);
      await initDB();

      await customSoundsStore.initialize();

      await appSetup(prayerTimesStore, notificationStore);
    };

    initializeApp().catch((error) => {
      console.error("App initialization failed: ", error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStore.isFirstRun]);
};
