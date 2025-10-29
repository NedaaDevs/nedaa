import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";

// Services
import { appSetup, firstRunSetup } from "@/services/setup";
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

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize Sentry based on user choice
      await initSentry(appStore.sendCrashLogs);
      await initDB();

      // First run setup(Request notification and location permission)
      await firstRunSetup(appStore);

      // Every run setup(Fetching data, schedule notifications)
      await appSetup(prayerTimesStore, notificationStore);
    };

    try {
      initializeApp();
    } catch (error) {
      console.error("App initialization failed: ", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
