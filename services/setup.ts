import * as Sentry from "@sentry/react-native";

import { parseISO } from "date-fns";
import { timeZonedNow } from "@/utils/date";

// Types
import { LocationStore } from "@/stores/location";
import { AppState } from "@/types/app";
import { NotificationState } from "@/types/notifications";
import { PrayerTimesStore } from "@/types/prayerTimes";

// Utils
import { cancelAllScheduledNotifications, scheduleNotification } from "@/utils/notifications";
import { requestLocationPermission } from "@/utils/location";

export const firstRunSetup = async (appStore: AppState, notificationStore: NotificationState) => {
  try {
    // Check existing notification permissions(This will update the store state with the current permissions)
    await notificationStore.refreshPermissions();

    // Only request if first run and permissions aren't determined
    if (appStore.isFirstRun) {
      const grantedNotificationsPermission =
        await notificationStore.requestNotificationPermission();

      if (!grantedNotificationsPermission) {
        console.log("User declined initial notifications permission request");
      }

      // Request Location permission
      await requestLocationPermission();

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
    const { loadPrayerTimes, twoWeeksTimings } = prayerStore;
    const { locationDetails } = locationStore;

    await loadPrayerTimes();

    // Early return if no prayer timings
    if (!twoWeeksTimings) {
      return;
    }
    // TODO: This will be refactored and moved to a better location(maybe we just call a func here that will handle scheduling logic)
    const now = timeZonedNow(locationDetails.timezone);
    const prayers = [];
    const MAX_NOTIFICATIONS = 65;

    for (const prayerTiming of twoWeeksTimings) {
      // Format date properly
      const datePart = prayerTiming.date.toString().padStart(8, "0");
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);

      // Process each prayer for this day
      for (const [name, timeString] of Object.entries(prayerTiming.timings)) {
        try {
          // Parse the prayer time
          let prayerTime;
          if (timeString.includes("T")) {
            // Already ISO format
            prayerTime = parseISO(timeString);
          } else {
            // Need to combine date and time
            prayerTime = parseISO(`${year}-${month}-${day}T${timeString}`);
          }

          // Add future prayers to our list
          if (prayerTime > now) {
            prayers.push({
              name,
              date: prayerTime,
            });

            // Stop once we reach the maximum number of notifications
            if (prayers.length >= MAX_NOTIFICATIONS) {
              break;
            }
          }
        } catch {
          // Silently ignore parsing errors
        }
      }

      // Also break out of the outer loop if we've reached max notifications
      if (prayers.length >= MAX_NOTIFICATIONS) {
        break;
      }
    }

    // Only proceed if we have prayers to schedule
    if (prayers.length > 0) {
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
    }
  } catch (error) {
    console.error("App setup failed:", error);
    Sentry.captureException(error);
  }
};
