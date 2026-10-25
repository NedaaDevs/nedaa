import { locationRootState } from "@/components/location/rootState";
import { LOCATION_FAILURE, LOCATION_ROOT_STATE, UPDATE_STEP } from "@/constants/Location";

const GRANTED = { granted: true, canAskAgain: true };
const BASE = {
  chosenCity: false,
  permission: GRANTED,
  failedStep: null,
  storedFailure: null,
  updating: false,
} as const;

describe("locationRootState", () => {
  it("shows the device's place with access and no failure", () => {
    expect(locationRootState(BASE)).toBe(LOCATION_ROOT_STATE.DEVICE);
  });

  it("waits for the first permission check before drawing a device state", () => {
    expect(locationRootState({ ...BASE, permission: null })).toBe(LOCATION_ROOT_STATE.CHECKING);
  });

  // A chosen city stands whatever the permission says.
  it.each([null, { granted: false, canAskAgain: false }])(
    "shows a chosen city whatever the permission (%o)",
    (permission) => {
      expect(locationRootState({ ...BASE, chosenCity: true, permission })).toBe(
        LOCATION_ROOT_STATE.MANUAL
      );
    }
  );

  it.each([
    [true, LOCATION_ROOT_STATE.PERMISSION],
    [false, LOCATION_ROOT_STATE.DENIED],
  ])("without access, asks or points to Settings (can ask: %s)", (canAskAgain, state) => {
    expect(locationRootState({ ...BASE, permission: { granted: false, canAskAgain } })).toBe(state);
  });

  it.each([UPDATE_STEP.LOCATION, UPDATE_STEP.PRAYER_TIMES])(
    "offers the way out after this screen's own run failed at %s, on a chosen city too",
    (failedStep) => {
      expect(locationRootState({ ...BASE, chosenCity: true, failedStep })).toBe(
        LOCATION_ROOT_STATE.FAILURE
      );
    }
  );

  // The place and its times are in; the mode's own body reports the step.
  it.each([UPDATE_STEP.NOTIFICATIONS, UPDATE_STEP.ALARMS])(
    "keeps the mode's state when the run failed at %s",
    (failedStep) => {
      expect(locationRootState({ ...BASE, failedStep })).toBe(LOCATION_ROOT_STATE.DEVICE);
      expect(locationRootState({ ...BASE, chosenCity: true, failedStep })).toBe(
        LOCATION_ROOT_STATE.MANUAL
      );
    }
  );

  // Access lost since the run failed: retrying could only fail again.
  it.each([
    [true, LOCATION_ROOT_STATE.PERMISSION],
    [false, LOCATION_ROOT_STATE.DENIED],
  ])(
    "asks or points to Settings when access is gone after a failed run (can ask: %s)",
    (canAskAgain, state) => {
      const permission = { granted: false, canAskAgain };
      expect(locationRootState({ ...BASE, permission, failedStep: UPDATE_STEP.LOCATION })).toBe(
        state
      );
    }
  );

  it("keeps a chosen city when access is gone after a failed run", () => {
    expect(
      locationRootState({
        ...BASE,
        chosenCity: true,
        permission: { granted: false, canAskAgain: false },
        failedStep: UPDATE_STEP.LOCATION,
      })
    ).toBe(LOCATION_ROOT_STATE.MANUAL);
  });

  it("offers the way out after an earlier device read failed", () => {
    expect(locationRootState({ ...BASE, storedFailure: LOCATION_FAILURE.TIMEOUT })).toBe(
      LOCATION_ROOT_STATE.FAILURE
    );
  });

  it("shows the read in progress, not the old failure, while a retry runs", () => {
    expect(
      locationRootState({ ...BASE, storedFailure: LOCATION_FAILURE.TIMEOUT, updating: true })
    ).toBe(LOCATION_ROOT_STATE.DEVICE);
  });

  // A refusal stored before access was given belongs to the permission states.
  it("drops a stored refusal once access is given", () => {
    expect(locationRootState({ ...BASE, storedFailure: LOCATION_FAILURE.DENIED })).toBe(
      LOCATION_ROOT_STATE.DEVICE
    );
  });
});
