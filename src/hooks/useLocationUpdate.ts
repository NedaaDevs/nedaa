import { useState, useCallback } from "react";

import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import type { ManualLocation } from "@/types/location";
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";

export type UpdateStep = "location" | "prayerTimes" | "notifications" | "alarms" | "done";

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

  const locationStore = useLocationStore();
  const prayerTimesStore = usePrayerTimesStore();
  const notificationStore = useNotificationStore();

  const runStep = async (step: UpdateStep, fn: () => Promise<void>) => {
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
    async (setCoordinates: () => Promise<void>) => {
      setUpdateState({ isUpdating: true, currentStep: null, error: null });

      try {
        await runStep("location", setCoordinates);
        await runStep("prayerTimes", () => prayerTimesStore.loadPrayerTimes(true));
        await runStep("notifications", () => notificationStore.scheduleAllNotifications());
        await runStep("alarms", () => rescheduleAllAlarms());

        reloadPrayerWidgets();

        setUpdateState({ isUpdating: false, currentStep: "done", error: null });

        setTimeout(() => {
          setUpdateState(initialState);
        }, 2000);
      } catch {
        // Error already captured in runStep
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

  const retry = useCallback(() => {
    executeUpdate();
  }, [executeUpdate]);

  return { updateState, executeUpdate, applyManualLocation, retry };
};
