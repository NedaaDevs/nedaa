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
  /** The step this screen's own last run failed at; null when none failed. */
  failedStep: UpdateStep | null;
  /** Why the last device read failed, kept until one succeeds. */
  storedFailure: LocationFailure | null;
  updating: boolean;
};

/** Which state the Location screen draws from what it knows now. */
export const locationRootState = ({
  chosenCity,
  permission,
  failedStep,
  storedFailure,
  updating,
}: Facts): LocationRootState => {
  // Notifications and alarms fail after the place and its times are in.
  const placeOrTimesFailed =
    failedStep === UPDATE_STEP.LOCATION || failedStep === UPDATE_STEP.PRAYER_TIMES;
  // Access lost since then: a retry could only fail again.
  const accessGone = permission !== null && !permission.granted;
  if (placeOrTimesFailed && !accessGone) return LOCATION_ROOT_STATE.FAILURE;
  if (chosenCity) return LOCATION_ROOT_STATE.MANUAL;
  if (!permission) return LOCATION_ROOT_STATE.CHECKING;
  if (!permission.granted) {
    return permission.canAskAgain ? LOCATION_ROOT_STATE.PERMISSION : LOCATION_ROOT_STATE.DENIED;
  }
  // A refusal stored before access was given is not a read that failed.
  const readFailed = storedFailure !== null && storedFailure !== LOCATION_FAILURE.DENIED;
  return readFailed && !updating ? LOCATION_ROOT_STATE.FAILURE : LOCATION_ROOT_STATE.DEVICE;
};
