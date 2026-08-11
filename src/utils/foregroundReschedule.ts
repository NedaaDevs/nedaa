import { AppState, AppStateStatus } from "react-native";

import { useNotificationStore } from "@/stores/notification";

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
      void useNotificationStore.getState().rescheduleIfNeeded(false);
    }
  });
};
