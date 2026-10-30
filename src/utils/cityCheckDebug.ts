import { Alert } from "react-native";

import { CITY_CHECK_TRIGGER } from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { runCityCheck, type CheckEnd } from "@/services/cityCheck";
import { useCityCheckStore } from "@/stores/cityCheck";
import type { PlaceMark } from "@/types/cityCheck";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const ageText = (at: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - at) / MINUTE_MS));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} ${DEBUG_COPY.MINUTES}`;
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  return hours < HOURS_PER_DAY
    ? `${hours} ${DEBUG_COPY.HOURS}`
    : `${Math.round(hours / HOURS_PER_DAY)} ${DEBUG_COPY.DAYS}`;
};

const listText = (label: string, marks: PlaceMark[]): string =>
  `${label}: ${marks.length}${marks.length ? ` (${marks.map(({ at }) => ageText(at)).join(", ")})` : ""}`;

/** Runs a check now, past the throttle, and shows how it ended. */
export const runCityCheckNow = async (): Promise<CheckEnd> => {
  useCityCheckStore.getState().forgetLastCheck();
  const end = await runCityCheck(CITY_CHECK_TRIGGER.LAUNCH);
  Alert.alert(DEBUG_COPY.RUN_CITY_CHECK, "offered" in end ? DEBUG_COPY.OFFERED : end.reason);
  return end;
};

/** Shows ages, counts and the phone zone; no place leaves the store. */
export const showCityCheckMemory = (): void => {
  const { lastCheckAt, lastPhoneZone, kept, notAsked } = useCityCheckStore.getState().cityCheck;
  const lines = [
    `${DEBUG_COPY.LAST_CHECK}: ${lastCheckAt === null ? DEBUG_COPY.NEVER_CHECKED : ageText(lastCheckAt)}`,
    `${DEBUG_COPY.PHONE_ZONE}: ${lastPhoneZone ?? DEBUG_COPY.NO_ZONE}`,
    listText(DEBUG_COPY.KEPT, kept),
    listText(DEBUG_COPY.NOT_ASKED, notAsked),
  ];
  Alert.alert(DEBUG_COPY.SHOW_CITY_CHECK_MEMORY, lines.join("\n"));
};

export const clearCityCheckMemory = (): void => {
  useCityCheckStore.getState().clearMemory();
  Alert.alert(DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY, DEBUG_COPY.CLEARED);
};
