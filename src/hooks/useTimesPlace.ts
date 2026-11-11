import { useSyncExternalStore } from "react";

import type { TimesPlace } from "@/constants/Location";
import { subscribeTimesPlace, timesPlace } from "@/utils/timesPlace";

/** Whose place the stored times are for; UNKNOWN until both stores load. */
export const useTimesPlace = (): TimesPlace =>
  useSyncExternalStore(subscribeTimesPlace, timesPlace);
