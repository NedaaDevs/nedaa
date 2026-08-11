import { AppState, AppStateStatus } from "react-native";

import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

let registered = false;

// Warm foregrounds never pass through appSetup, so without this a device the
// user never cold-starts stops getting fresh notifications once the scheduled
// horizon runs out. rescheduleIfNeeded's same-day guard caps it at one real
// run per day.
export const registerForegroundReschedule = (): void => {
  if (registered) return;
  registered = true;

  AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      void (async () => {
        // The reschedule reads the store's two-week projection, so re-derive it
        // from the database first; otherwise the top-up schedules the window of
        // the last cold start.
        await usePrayerTimesStore.getState().refreshTimingsFromDb();
        await useNotificationStore.getState().rescheduleIfNeeded(false);
      })();
    }
  });
};
