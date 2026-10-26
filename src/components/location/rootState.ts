import {
  LOCATION_FAILURE,
  LOCATION_ROOT_STATE,
  UPDATE_STEP,
  type LocationFailure,
  type LocationRootState,
  type UpdateStep,
} from "@/constants/Location";
import type { LocationPermission } from "@/types/location";

type Facts = {
  /** The times follow a city the user chose. */
  chosenCity: boolean;
  /** Null until the first check answers. */
  permission: LocationPermission | null;
  /** The step the last update run failed at; null when none failed. */
  failedStep: UpdateStep | null;
  /** Why the last device read failed, kept until one succeeds. */
  storedFailure: LocationFailure | null;
  /** A device read runs; `running` covers a run's own read. */
  reading: boolean;
  /** An update run is in flight. */
  running: boolean;
};

/** A run stopped before its place had times: the failure card's case. */
export const failedAtPlaceOrTimes = (step: UpdateStep | null): boolean =>
  step === UPDATE_STEP.LOCATION || step === UPDATE_STEP.PRAYER_TIMES;

/** Which state the Location screen draws from what it knows now. */
export const locationRootState = ({
  chosenCity,
  permission,
  failedStep,
  storedFailure,
  reading,
  running,
}: Facts): LocationRootState => {
  if (running) return LOCATION_ROOT_STATE.UPDATING;
  // Access lost since then: a retry could only fail again.
  const accessGone = permission !== null && !permission.granted;
  if (failedAtPlaceOrTimes(failedStep) && !accessGone) return LOCATION_ROOT_STATE.FAILURE;
  if (chosenCity) return LOCATION_ROOT_STATE.MANUAL;
  if (!permission) return LOCATION_ROOT_STATE.CHECKING;
  if (!permission.granted) {
    return permission.canAskAgain ? LOCATION_ROOT_STATE.PERMISSION : LOCATION_ROOT_STATE.DENIED;
  }
  // A refusal stored before access was given is not a read that failed.
  const readFailed = storedFailure !== null && storedFailure !== LOCATION_FAILURE.DENIED;
  return readFailed && !reading ? LOCATION_ROOT_STATE.FAILURE : LOCATION_ROOT_STATE.DEVICE;
};
