import * as Sentry from "@sentry/react-native";

// Types
import { LocationStore } from "@/types/location";
import { AppState } from "@/types/app";
import { NotificationState } from "@/types/notifications";
import { PrayerTimesStore } from "@/types/prayerTimes";
import { cancelAllScheduledNotifications, scheduleNotification } from "@/utils/notifications";
import { differenceInSeconds, parseISO } from "date-fns";
import { timeZonedNow } from "@/utils/date";

export const performFirstRunSetup = async (
  appStore: AppState,
  notificationStore: NotificationState,
  locationStore: LocationStore
) => {
  try {
    // Check existing notification permissions(This will update the store state with the current permissions)
    await notificationStore.refreshPermissions();
    await locationStore.checkPermissions();

    // Only request if first run and permissions aren't determined
    if (appStore.isFirstRun) {
      const grantedNotificationsPermission =
        await notificationStore.requestNotificationPermission();
      const grantedLocationPermission = await locationStore.requestPermissions();

      if (!grantedNotificationsPermission) {
        console.log("User declined initial notifications permission request");
      }

      // if the user granted location permission get current location
      if (grantedLocationPermission) {
        await locationStore.getCurrentLocation();
      }

      // Mark first run as complete
      appStore.setIsFirstRun(false);
    }
  } catch (error) {
    console.error("First run setup failed:", error);
    Sentry.captureException(error);
  }
};

export const appSetup = async (locationStore: LocationStore, prayerStore: PrayerTimesStore) => {
  try {
    const { loadPrayerTimes, todayTimings } = prayerStore;
    const { locationDetails } = locationStore;

    await loadPrayerTimes();

    if (!todayTimings) return;

    const now = timeZonedNow(locationDetails.timezone);
    const prayers = Object.entries(todayTimings.timings)
      .map(([name, time]) => {
        const prayerTime = parseISO(time as string);

        return {
          name,
          date: prayerTime,
        };
      })
      // Filter out past prayer times
      .filter((prayer) => prayer.date > now);

    await cancelAllScheduledNotifications();

    await Promise.all(
      prayers.map((prayer) =>
        scheduleNotification(
          prayer.date,
          `Time for ${prayer.name}`,
          `It's time to pray ${prayer.name}`
        )
      )
    );
  } catch (error) {
    console.error("App setup failed:", error);
    Sentry.captureException(error);
  }
};
