import { useState, useCallback, useRef } from "react";

import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import type { ManualLocation } from "@/types/location";
import { UPDATE_STEP, type UpdateStep } from "@/constants/Location";
import { reloadPrayerWidgets } from "expo-widget";

export type UpdateState = {
  isUpdating: boolean;
  currentStep: UpdateStep | null;
  error: { step: UpdateStep; message: string } | null;
};

const initialState: UpdateState = {
  isUpdating: false,
  currentStep: null,
  error: null,
};

export const useLocationUpdate = () => {
  const [updateState, setUpdateState] = useState<UpdateState>(initialState);
  // The first step of the last pipeline run, so a retry repeats that action.
  const lastSetCoordinates = useRef<(() => Promise<void>) | null>(null);

  const locationStore = useLocationStore();
  const prayerTimesStore = usePrayerTimesStore();
  const notificationStore = useNotificationStore();

  const runStep = async (step: UpdateStep, fn: () => Promise<unknown>) => {
    setUpdateState((prev) => ({ ...prev, currentStep: step, error: null }));
    try {
      await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setUpdateState((prev) => ({
        ...prev,
        isUpdating: false,
        error: { step, message },
      }));
      throw error;
    }
  };

  /**
   * Everything after the coordinates is identical whether they came from the device or
   * from a city the user picked, so only the first step differs. A step that throws
   * stops the pipeline, leaving the failure on screen rather than half-applying it.
   */
  const runPipeline = useCallback(
    async (setCoordinates: () => Promise<void>): Promise<boolean> => {
      lastSetCoordinates.current = setCoordinates;
      setUpdateState({ isUpdating: true, currentStep: null, error: null });

      try {
        await runStep(UPDATE_STEP.LOCATION, setCoordinates);
        await runStep(UPDATE_STEP.PRAYER_TIMES, () => prayerTimesStore.loadPrayerTimes(true));
        await runStep(UPDATE_STEP.NOTIFICATIONS, () =>
          notificationStore.scheduleAllNotifications()
        );
        await runStep(UPDATE_STEP.ALARMS, () => rescheduleAllAlarms());

        reloadPrayerWidgets();

        setUpdateState({ isUpdating: false, currentStep: UPDATE_STEP.DONE, error: null });

        setTimeout(() => {
          setUpdateState(initialState);
        }, 2000);
        return true;
      } catch {
        // Error already captured in runStep. Reported as a return value because the
        // caller cannot read the fresh updateState from inside the same render.
        return false;
      }
    },
    [prayerTimesStore, notificationStore]
  );

  const executeUpdate = useCallback(
    () => runPipeline(() => locationStore.updateCurrentLocation()),
    [runPipeline, locationStore]
  );

  const applyManualLocation = useCallback(
    (location: ManualLocation) =>
      runPipeline(async () => locationStore.setManualLocation(location)),
    [runPipeline, locationStore]
  );

  // The device read comes first; a failed read leaves the chosen city.
  const switchToDevice = useCallback(
    () => runPipeline(() => locationStore.adoptDeviceLocation()),
    [runPipeline, locationStore]
  );

  const retry = useCallback(
    () => (lastSetCoordinates.current ? runPipeline(lastSetCoordinates.current) : executeUpdate()),
    [runPipeline, executeUpdate]
  );

  // A running update stays on screen; only a finished one is closed.
  const dismissFailure = useCallback(
    () => setUpdateState((prev) => (prev.isUpdating ? prev : initialState)),
    []
  );

  return { updateState, executeUpdate, applyManualLocation, switchToDevice, retry, dismissFailure };
};
