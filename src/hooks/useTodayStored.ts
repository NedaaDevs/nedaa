import { useSyncExternalStore } from "react";

import { subscribeTimesPlace, todayStored } from "@/utils/timesPlace";

/** Whether today's times are stored, for a verified place. */
export const useTodayStored = (): boolean => useSyncExternalStore(subscribeTimesPlace, todayStored);
