import { STEP_OUTCOME, UPDATE_STEP, type StepOutcome, type UpdateStep } from "@/constants/Location";
import { SchedulingSkipReason } from "@/enums/notifications";
import type { SchedulingResult } from "@/types/notification";

/** Each step's outcome; a step the run never reached is absent. */
export type StepOutcomes = Partial<Record<UpdateStep, StepOutcome>>;

// Whether a partial outcome stops the run. Partial times still show the new
// place's window; partial alerts leave some at the old place's times.
const PARTIAL_STOPS: Record<UpdateStep, boolean> = {
  [UPDATE_STEP.LOCATION]: false,
  [UPDATE_STEP.PRAYER_TIMES]: false,
  [UPDATE_STEP.NOTIFICATIONS]: true,
  [UPDATE_STEP.ALARMS]: true,
};

/** The notifications step's outcome, read from the scheduler's result. */
export const notificationsOutcome = (result: SchedulingResult): StepOutcome => {
  // With no stored times, nothing could be scheduled for the new place.
  if (result.skipReason === SchedulingSkipReason.NO_PRAYER_TIMES) return STEP_OUTCOME.FAILED;
  if (result.skipReason) return STEP_OUTCOME.SKIPPED;
  if (!result.success) return STEP_OUTCOME.FAILED;
  if ((result.failedCount ?? 0) > 0) return STEP_OUTCOME.PARTIAL;
  return STEP_OUTCOME.DONE;
};

/** The first step, in run order, whose outcome stops the run; else null. */
export const stopOf = (outcomes: StepOutcomes): UpdateStep | null =>
  Object.values(UPDATE_STEP).find((step) => {
    const outcome = outcomes[step];
    return (
      outcome === STEP_OUTCOME.FAILED || (outcome === STEP_OUTCOME.PARTIAL && PARTIAL_STOPS[step])
    );
  }) ?? null;
