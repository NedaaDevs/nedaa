import { create } from "zustand";
import type { ParseKeys } from "i18next";

import { UPDATE_START, UPDATE_STEP, type UpdateStep } from "@/constants/Location";
import { useLocationStore, type LocationStore } from "@/stores/location";
import type { ManualLocation } from "@/types/location";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

/** Where an update takes its place from; a city carries itself. */
export type UpdateStart =
  | { kind: typeof UPDATE_START.DEVICE }
  | { kind: typeof UPDATE_START.ADOPT_DEVICE }
  | { kind: typeof UPDATE_START.CITY; city: ManualLocation };

/** An update in flight, or the last one when a step threw. */
export type UpdateRun = {
  start: UpdateStart;
  /** The step running now, or the one that threw. */
  step: UpdateStep;
  failed: boolean;
};

/** The steps of one run; each step is entered before it starts. */
export type UpdateSteps = (enter: (step: UpdateStep) => void) => Promise<void>;

type LocationUpdateStore = {
  /** Null when no run is in flight and the last one landed or was closed. */
  run: UpdateRun | null;
  /** The one update in flight: true once every step ran, else false. */
  withRun: (start: UpdateStart, steps: UpdateSteps) => Promise<boolean>;
  /** Closes a failed run; a running one stays. */
  dismissFailure: () => void;
};

/** Whether `run` is in flight rather than stopped by a throw. */
export const isRunning = (run: UpdateRun | null): boolean => run !== null && !run.failed;

/** Whether `run` reads the device at its place step: the city is not known. */
export const findingCity = (run: UpdateRun | null): boolean =>
  isRunning(run) && run?.step === UPDATE_STEP.LOCATION && run.start.kind !== UPDATE_START.CITY;

/** The line a device read shows while it finds the city. */
export const FINDING_CITY: ParseKeys = "onboarding.fetch.locatingDevice";

export const useLocationUpdateStore = create<LocationUpdateStore>()((set, get) => ({
  run: null,

  withRun: async (start, steps) => {
    if (isRunning(get().run)) return false;
    set({ run: { start, step: UPDATE_STEP.LOCATION, failed: false } });
    let landed = false;
    try {
      await steps((step) => set(({ run }) => ({ run: run && { ...run, step } })));
      landed = true;
    } catch (error) {
      log.w("Update", `update stopped at ${get().run?.step}: ${errorText(error)}`);
    } finally {
      // Every way out releases the lock; a throw keeps the step it stopped at.
      set(({ run }) => ({ run: landed || !run ? null : { ...run, failed: true } }));
    }
    return landed;
  },

  dismissFailure: () => set(({ run }) => ({ run: run?.failed ? null : run })),
}));

/** Whether the saved place changed: its mode, its city or its point. */
const placeMoved = (now: LocationStore, before: LocationStore): boolean =>
  now.locationMode !== before.locationMode ||
  now.manualLocation !== before.manualLocation ||
  now.locationDetails.coords !== before.locationDetails.coords;

// A place set another way leaves a failed run's start, and its retry, stale.
useLocationStore.subscribe((now, before) => {
  if (placeMoved(now, before)) useLocationUpdateStore.getState().dismissFailure();
});
