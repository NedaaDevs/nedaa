import { Alert } from "react-native";

import { CITY_CHECK_TRIGGER } from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { runCityCheck } from "@/services/cityCheck";
import { useCityCheckStore } from "@/stores/cityCheck";
import type { PlaceMark } from "@/types/cityCheck";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const ageText = (at: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - at) / MINUTE_MS));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  return hours < HOURS_PER_DAY ? `${hours} h` : `${Math.round(hours / HOURS_PER_DAY)} d`;
};

const listText = (label: string, marks: PlaceMark[]): string =>
  `${label}: ${marks.length}${marks.length ? ` (${marks.map(({ at }) => ageText(at)).join(", ")})` : ""}`;

/** Runs a check now, past the throttle. */
export const runCityCheckNow = (): Promise<void> => {
  useCityCheckStore.getState().forgetLastCheck();
  return runCityCheck(CITY_CHECK_TRIGGER.LAUNCH);
};

/** Shows counts and ages only; a mark's place stays out of the text. */
export const showCityCheckMemory = (): void => {
  const { lastCheckAt, lastPhoneZone, kept, notAsked } = useCityCheckStore.getState().cityCheck;
  const lines = [
    `last check: ${lastCheckAt === null ? DEBUG_COPY.NEVER_CHECKED : ageText(lastCheckAt)}`,
    `phone zone: ${lastPhoneZone ?? DEBUG_COPY.NO_ZONE}`,
    listText("kept", kept),
    listText("notAsked", notAsked),
  ];
  Alert.alert(DEBUG_COPY.SHOW_CITY_CHECK_MEMORY, lines.join("\n"));
};

export const clearCityCheckMemory = (): void => useCityCheckStore.getState().clearMemory();
