import { create } from "zustand";
import type { ParseKeys } from "i18next";

import {
  RUN_END,
  STEP_OUTCOME,
  UPDATE_START,
  UPDATE_STEP,
  type StepOutcome,
  type UpdateStep,
} from "@/constants/Location";
import { useLocationStore, type LocationStore } from "@/stores/location";
import type { CityCandidate } from "@/types/cityCheck";
import type { ManualLocation } from "@/types/location";
import { AppLogger } from "@/utils/appLogger";
import { stopOf, type StepOutcomes } from "@/utils/updateOutcome";

const log = AppLogger.create("location");

/** Where an update takes its place from; a city carries itself. */
export type UpdateStart =
  | { kind: typeof UPDATE_START.DEVICE }
  | { kind: typeof UPDATE_START.ADOPT_DEVICE }
  | { kind: typeof UPDATE_START.CITY; city: ManualLocation }
  | { kind: typeof UPDATE_START.CANDIDATE; candidate: CityCandidate };

/** An update in flight, or the last one when a step stopped it. */
export type UpdateRun = {
  start: UpdateStart;
  /** The step running now, or the one the run stopped at. */
  step: UpdateStep;
  failed: boolean;
};

/** Enters `step`, runs its work and records its outcome; a throw is FAILED. */
export type RunStep = (step: UpdateStep, work: () => Promise<StepOutcome>) => Promise<StepOutcome>;

/** The steps of one run, each run through `runStep`. */
export type UpdateSteps = (runStep: RunStep) => Promise<void>;

/** How a run ended; a refused run never started, so it has no outcomes. */
export type UpdateResult =
  | { end: typeof RUN_END.LANDED; outcomes: StepOutcomes }
  | { end: typeof RUN_END.STOPPED; step: UpdateStep; outcomes: StepOutcomes }
  | { end: typeof RUN_END.REFUSED };

/** Whether every step ran and none stopped the run. */
export const updateLanded = (result: UpdateResult): boolean => result.end === RUN_END.LANDED;

type LocationUpdateStore = {
  /** Null when no run is in flight and the last one landed or was closed. */
  run: UpdateRun | null;
  /** The one update in flight, and how it ended. */
  withRun: (start: UpdateStart, steps: UpdateSteps) => Promise<UpdateResult>;
  /** Closes a failed run; a running one stays. */
  dismissFailure: () => void;
};

/** Whether `run` is in flight rather than stopped by a throw. */
export const isRunning = (run: UpdateRun | null): boolean => run !== null && !run.failed;

/** Whether `run` reads the device at its place step: the city is not known. */
export const findingCity = (run: UpdateRun | null): boolean =>
  isRunning(run) &&
  run?.step === UPDATE_STEP.LOCATION &&
  (run.start.kind === UPDATE_START.DEVICE || run.start.kind === UPDATE_START.ADOPT_DEVICE);

/** The line a device read shows while it finds the city. */
export const FINDING_CITY: ParseKeys = "onboarding.fetch.locatingDevice";

export const useLocationUpdateStore = create<LocationUpdateStore>()((set, get) => ({
  run: null,

  withRun: async (start, steps) => {
    if (isRunning(get().run)) return { end: RUN_END.REFUSED };
    set({ run: { start, step: UPDATE_STEP.LOCATION, failed: false } });
    const outcomes: StepOutcomes = {};
    // The step in flight; the run starts at the place step.
    let current: UpdateStep | null = UPDATE_STEP.LOCATION;
    const runStep: RunStep = async (step, work) => {
      current = step;
      set(({ run }) => ({ run: run && { ...run, step } }));
      let outcome: StepOutcome = STEP_OUTCOME.FAILED;
      try {
        outcome = await work();
      } catch {
        // The step's name only: an error's text can hold the place.
        log.w("Update", `${step} threw`);
      } finally {
        outcomes[step] = outcome;
        current = null;
      }
      return outcome;
    };
    let stop: UpdateStep | null = null;
    try {
      await steps(runStep);
    } catch {
      // A throw between steps fails the first step it left unrun; one after
      // the last step leaves the run landed.
      const failedAt =
        current ?? Object.values(UPDATE_STEP).find((step) => outcomes[step] === undefined);
      if (failedAt) outcomes[failedAt] = STEP_OUTCOME.FAILED;
      log.w("Update", `update threw at ${failedAt ?? "no step"}`);
    } finally {
      // Every way out releases the lock; a stop keeps the step it stopped at.
      stop = stopOf(outcomes);
      set(({ run }) => ({ run: stop && run ? { ...run, step: stop, failed: true } : null }));
    }
    // Step names and outcome codes only: the log never holds the place.
    const codes = Object.entries(outcomes).map(([step, outcome]) => `${step}=${outcome}`);
    log.i("Update", `update ${stop ? `stopped at ${stop}` : "landed"}: ${codes.join(" ")}`);
    return stop
      ? { end: RUN_END.STOPPED, step: stop, outcomes }
      : { end: RUN_END.LANDED, outcomes };
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
