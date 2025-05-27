import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Services
import { appSetup, firstRunSetup } from "@/services/setup";
import { PrayerTimesDB } from "@/services/db";

const initSentry = (consent: boolean) => {
  if (!__DEV__ && consent) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      enabled: !__DEV__,
      // Configure Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1,
      integrations: [Sentry.mobileReplayIntegration()],
    });
  }
};

const initDB = async () => {
  await PrayerTimesDB.initialize();
};

export const useInitialSetup = () => {
  const appStore = useAppStore();
  const locationStore = useLocationStore();
  const prayerTimesStore = usePrayerTimesStore();

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize Sentry based on user choice
      await initSentry(appStore.sendCrashLogs);
      await initDB();

      // First run setup(Request notification and location permission)
      await firstRunSetup(appStore);

      // Every run setup(Fetching data, schedule notifications)
      await appSetup(locationStore, prayerTimesStore);
    };

    try {
      initializeApp();
    } catch (error) {
      console.error("App initialization failed: ", error);
    }
  }, []);
};
