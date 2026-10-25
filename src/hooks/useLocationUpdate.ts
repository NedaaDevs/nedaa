import { useTranslation } from "react-i18next";
import { AccessibilityInfo } from "react-native";
import { reloadPrayerWidgets } from "expo-widget";

import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { useHaptic } from "@/hooks/useHaptic";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore, type UpdateStart } from "@/stores/locationUpdate";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { ManualLocation } from "@/types/location";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";

const DEVICE_START: UpdateStart = { kind: UPDATE_START.DEVICE };

/** Sets the place: the only step that differs between the starts. */
const takePlace = async (start: UpdateStart): Promise<void> => {
  const location = useLocationStore.getState();
  switch (start.kind) {
    case UPDATE_START.DEVICE:
      return location.updateCurrentLocation();
    case UPDATE_START.ADOPT_DEVICE:
      // The device read comes first; a failed read leaves the chosen city.
      return location.adoptDeviceLocation();
    case UPDATE_START.CITY:
      return location.setManualLocation(start.city);
    default: {
      const unhandled: never = start;
      return unhandled;
    }
  }
};

/** Place, times, notifications, alarms; a throw stops the rest of the run. */
const runUpdate = (start: UpdateStart): Promise<boolean> =>
  useLocationUpdateStore.getState().withRun(start, async (enter) => {
    await takePlace(start);
    enter(UPDATE_STEP.PRAYER_TIMES);
    await usePrayerTimesStore.getState().loadPrayerTimes(true);
    enter(UPDATE_STEP.NOTIFICATIONS);
    await useNotificationStore.getState().scheduleAllNotifications();
    enter(UPDATE_STEP.ALARMS);
    await rescheduleAllAlarms();
    reloadPrayerWidgets();
  });

/** The one location update: the run in flight and the ways to start one. */
export const useLocationUpdate = () => {
  const { t } = useTranslation();
  const successHaptic = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const run = useLocationUpdateStore((state) => state.run);
  const dismissFailure = useLocationUpdateStore((state) => state.dismissFailure);

  // Resolves whether this call's run landed; the screen then shows the place.
  const update = async (start: UpdateStart): Promise<boolean> => {
    const landed = await runUpdate(start);
    if (landed) {
      void successHaptic();
      // The status line and its live region leave with the run; say the end.
      AccessibilityInfo.announceForAccessibility(t("location.update.step.done"));
    }
    return landed;
  };

  return {
    run,
    executeUpdate: () => update(DEVICE_START),
    applyManualLocation: (city: ManualLocation) => update({ kind: UPDATE_START.CITY, city }),
    switchToDevice: () => update({ kind: UPDATE_START.ADOPT_DEVICE }),
    // Repeats the last run's own start, whichever screen it was begun on.
    retry: () => update(useLocationUpdateStore.getState().run?.start ?? DEVICE_START),
    dismissFailure,
  };
};
