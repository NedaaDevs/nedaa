import { useSyncExternalStore } from "react";

import { TIMES_PLACE } from "@/constants/Location";
import { subscribeTimesPlace, timesPlace } from "@/utils/timesPlace";

/** Whether the stored times are a verified place's; false until both load. */
export const useVerifiedPlace = (): boolean =>
  useSyncExternalStore(subscribeTimesPlace, timesPlace) === TIMES_PLACE.VERIFIED;
