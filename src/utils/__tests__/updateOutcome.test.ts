import { STEP_OUTCOME, UPDATE_STEP, type StepOutcome } from "@/constants/Location";
import { SchedulingSkipReason } from "@/enums/notifications";
import type { SchedulingResult } from "@/types/notification";
import { notificationsOutcome, stopOf, type StepOutcomes } from "@/utils/updateOutcome";

describe("notificationsOutcome", () => {
  it.each<[string, SchedulingResult, StepOutcome]>([
    ["every item scheduled", { success: true, scheduledCount: 12 }, STEP_OUTCOME.DONE],
    ["nothing due", { success: true, scheduledCount: 0 }, STEP_OUTCOME.DONE],
    [
      "some items failed",
      { success: true, scheduledCount: 10, failedCount: 2 },
      STEP_OUTCOME.PARTIAL,
    ],
    [
      "notifications off",
      {
        success: true,
        scheduledCount: 0,
        skipReason: SchedulingSkipReason.NOTIFICATIONS_DISABLED,
      },
      STEP_OUTCOME.SKIPPED,
    ],
    [
      "screenshot build",
      { success: true, scheduledCount: 0, skipReason: SchedulingSkipReason.SCREENSHOT_MODE },
      STEP_OUTCOME.SKIPPED,
    ],
    [
      "permission not granted",
      {
        success: false,
        scheduledCount: 0,
        skipReason: SchedulingSkipReason.PERMISSION_NOT_GRANTED,
      },
      STEP_OUTCOME.SKIPPED,
    ],
    [
      "no stored times",
      { success: false, scheduledCount: 0, skipReason: SchedulingSkipReason.NO_PRAYER_TIMES },
      STEP_OUTCOME.FAILED,
    ],
    [
      "every item failed",
      { success: false, scheduledCount: 0, failedCount: 3, error: new Error("os") },
      STEP_OUTCOME.FAILED,
    ],
  ])("reads %s as its outcome", (_name, result, outcome) => {
    expect(notificationsOutcome(result)).toBe(outcome);
  });
});

describe("stopOf", () => {
  const ALL_DONE: StepOutcomes = Object.fromEntries(
    Object.values(UPDATE_STEP).map((step) => [step, STEP_OUTCOME.DONE])
  );

  it("finds no stop when every step is done", () => expect(stopOf(ALL_DONE)).toBeNull());

  // The window shown is the new place's; only next year's days are owed.
  it("finds no stop at a partial times step", () =>
    expect(stopOf({ ...ALL_DONE, [UPDATE_STEP.PRAYER_TIMES]: STEP_OUTCOME.PARTIAL })).toBeNull());

  it("finds no stop when the alerts were skipped", () =>
    expect(
      stopOf({
        ...ALL_DONE,
        [UPDATE_STEP.NOTIFICATIONS]: STEP_OUTCOME.SKIPPED,
        [UPDATE_STEP.ALARMS]: STEP_OUTCOME.SKIPPED,
      })
    ).toBeNull());

  it.each([UPDATE_STEP.NOTIFICATIONS, UPDATE_STEP.ALARMS])("stops at partial %s", (step) =>
    expect(stopOf({ ...ALL_DONE, [step]: STEP_OUTCOME.PARTIAL })).toBe(step)
  );

  it("stops at the first failed step, in run order", () =>
    expect(
      stopOf({
        ...ALL_DONE,
        [UPDATE_STEP.ALARMS]: STEP_OUTCOME.FAILED,
        [UPDATE_STEP.NOTIFICATIONS]: STEP_OUTCOME.FAILED,
      })
    ).toBe(UPDATE_STEP.NOTIFICATIONS));
});
