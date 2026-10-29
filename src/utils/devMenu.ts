import { registerDevMenuItems } from "expo-dev-menu";

import { CITY_CHECK_OFFER, REUSE_FIX_MAX_AGE_MS } from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { calculateDistance } from "@/utils/location";
import { phoneZoneReadings } from "@/utils/phoneZone";
import type { CityCandidate, LocalizedPlaceName } from "@/types/cityCheck";

const log = AppLogger.create("app");

const SAMPLE_POINT = { latitude: 21.5433, longitude: 39.1728 };
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

/** Puts a sample offer up; a chosen city is never offered the device's place. */
const showSample = (name: LocalizedPlaceName | null, distanceKm?: number) => {
  const location = useLocationStore.getState();
  if (location.locationMode !== LocationMode.DEVICE) {
    log.i("DevMenu", "a city is chosen; no city change to offer");
    return;
  }
  const saved = location.lastKnownCoords;
  const km =
    distanceKm ??
    (saved
      ? calculateDistance(
          saved.latitude,
          saved.longitude,
          SAMPLE_POINT.latitude,
          SAMPLE_POINT.longitude
        )
      : 0);
  location.offerCity(sampleCandidate(name, km), [CITY_CHECK_OFFER.SHIFT]);
};

/** Adds the debug items to the dev menu, which a release build lacks. */
export const registerDevMenu = (): Promise<void> => {
  if (!__DEV__) return Promise.resolve();
  return registerDevMenuItems([
    {
      name: DEBUG_COPY.RESTART_ONBOARDING,
      callback: () => useAppStore.getState().restartOnboarding(),
      shouldCollapse: true,
    },
    {
      // A check needs a real move; these put an offer up at once.
      name: DEBUG_COPY.SHOW_CITY_CHANGE,
      callback: () => showSample({ name: DEBUG_COPY.SAMPLE_NEW_CITY, names: null }),
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED,
      callback: () => showSample(null, UNNAMED_SAMPLE_KM),
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.LOG_PHONE_ZONE,
      callback: () => {
        const { intl, calendar } = phoneZoneReadings();
        log.i("DevMenu", `phone zone: intl=${intl} calendar=${calendar}`);
      },
      shouldCollapse: true,
    },
  ]).catch((error: unknown) => {
    log.w("DevMenu", `dev menu items not added: ${errorText(error)}`);
  });
};
