import { Alert } from "react-native";

import { CITY_CHECK_OFFER, CITY_CHECK_TRIGGER, REUSE_FIX_MAX_AGE_MS } from "@/constants/CityCheck";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { runCityCheck, type CheckEnd } from "@/services/cityCheck";
import { LocationMode } from "@/enums/location";
import { useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { AppLogger } from "@/utils/appLogger";
import { distanceBetween } from "@/utils/location";
import type { CityCandidate, LocalizedPlaceName, PlaceMark } from "@/types/cityCheck";

const log = AppLogger.create("app");

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

// In the Red Sea, far from any city: a kept sample silences no real place.
const SAMPLE_POINT = { latitude: 21.0, longitude: 38.4 };
const SAMPLE_ACCURACY_KM = 0.1;
const UNNAMED_SAMPLE_KM = 40;

// Too old to reuse, so a Use from a sample reads the device.
const sampleCandidate = (name: LocalizedPlaceName | null, distanceKm: number): CityCandidate => ({
  point: SAMPLE_POINT,
  accuracyKm: SAMPLE_ACCURACY_KM,
  fixedAt: Date.now() - REUSE_FIX_MAX_AGE_MS - 1,
  zone: null,
  countryCode: COUNTRY_CODE.SAUDI_ARABIA,
  name,
  distanceKm,
});

/** Puts a sample offer up; never over a chosen city. */
const showSample = (name: LocalizedPlaceName | null, distanceKm?: number) => {
  const location = useLocationStore.getState();
  if (location.locationMode !== LocationMode.DEVICE) {
    log.i("CityCheckDebug", "a city is chosen; no city change to offer");
    return;
  }
  const saved = location.lastKnownCoords;
  const km = distanceKm ?? (saved ? distanceBetween(saved, SAMPLE_POINT) : 0);
  location.offerCity(sampleCandidate(name, km), [CITY_CHECK_OFFER.SHIFT]);
};

// A real check needs a real move; these put an offer up at once.
export const showNamedCityChange = (): void =>
  showSample({ name: DEBUG_COPY.SAMPLE_NEW_CITY, names: null });

export const showUnnamedCityChange = (): void => showSample(null, UNNAMED_SAMPLE_KM);
