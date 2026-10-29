import { useTranslation } from "react-i18next";
import { AccessibilityInfo } from "react-native";
import { reloadPrayerWidgets } from "expo-widget";

import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { STEP_OUTCOME, UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { useHaptic } from "@/hooks/useHaptic";
import { useLocationStore } from "@/stores/location";
import {
  updateLanded,
  useLocationUpdateStore,
  type UpdateResult,
  type UpdateStart,
} from "@/stores/locationUpdate";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { ManualLocation } from "@/types/location";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { notificationsOutcome } from "@/utils/updateOutcome";

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

/** Place, times, notifications, alarms; the alerts need the place and times. */
const runUpdate = (start: UpdateStart): Promise<UpdateResult> =>
  useLocationUpdateStore.getState().withRun(start, async (runStep) => {
    const placed = await runStep(UPDATE_STEP.LOCATION, async () => {
      await takePlace(start);
      return STEP_OUTCOME.DONE;
    });
    if (placed === STEP_OUTCOME.FAILED) return;
    const times = await runStep(UPDATE_STEP.PRAYER_TIMES, async () => {
      const { placeRevision } = useLocationStore.getState();
      // The place step set the place; a second device fix would move it.
      const landed = await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);
      // A newer place owns the times; this run's place never got them.
      if (useLocationStore.getState().placeRevision !== placeRevision) return STEP_OUTCOME.FAILED;
      // False while next year's days are owed; the window is the new place's.
      return landed ? STEP_OUTCOME.DONE : STEP_OUTCOME.PARTIAL;
    });
    // Notifications read the stored days, which a failed load leaves stale.
    if (times === STEP_OUTCOME.FAILED) return;
    await runStep(UPDATE_STEP.NOTIFICATIONS, async () =>
      notificationsOutcome(await useNotificationStore.getState().scheduleAllNotifications())
    );
    // Runs after a failed notifications step, so no alarm keeps the old time.
    await runStep(UPDATE_STEP.ALARMS, rescheduleAllAlarms);
    reloadPrayerWidgets();
  });

/** The one location update: the run in flight and the ways to start one. */
export const useLocationUpdate = () => {
  const { t } = useTranslation();
  const successHaptic = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const run = useLocationUpdateStore((state) => state.run);
  const dismissFailure = useLocationUpdateStore((state) => state.dismissFailure);

  // Confirms a landed run by touch and voice; resolves whether it landed.
  const confirmLanded = (result: UpdateResult): boolean => {
    if (!updateLanded(result)) return false;
    void successHaptic();
    // The status line and its live region leave with the run; say the end.
    AccessibilityInfo.announceForAccessibility(t("location.update.step.done"));
    return true;
  };

  // Resolves whether this call's run landed; the screen then shows the place.
  const update = async (start: UpdateStart): Promise<boolean> =>
    confirmLanded(await runUpdate(start));

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
