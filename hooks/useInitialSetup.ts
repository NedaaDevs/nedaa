import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";
import { useLocationStore } from "@/stores/location";

// Services
import { performFirstRunSetup } from "@/services/setup";
import { PrayerTimesDB } from "@/services/db";

const initSentry = (consent: boolean) => {
  if (consent) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      enabled: !__DEV__,
    });
  }
};

const initDB = async () => {
  await PrayerTimesDB.initialize();
};

export const useInitialSetup = () => {
  const appStore = useAppStore();
  const notificationStore = useNotificationStore();
  const locationStore = useLocationStore();

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize Sentry based on user choice
      await initSentry(appStore.sendCrashLogs);

      await initDB();

      await performFirstRunSetup(appStore, notificationStore, locationStore);
    };

    initializeApp();
  }, []);
};
