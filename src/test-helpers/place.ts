import { useLocationStore, type LocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { RIYADH_COORDS, RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { ManualLocation } from "@/types/location";

/** Sets the two place facts: the prayer store's flag and the saved fix. */
export const placeFacts = (
  usingDefaultLocation: boolean,
  lastKnownCoords: LocationStore["lastKnownCoords"]
) => {
  usePrayerTimesStore.setState({ usingDefaultLocation });
  useLocationStore.setState({ lastKnownCoords });
};

const SAUDI_ARABIA = { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } };

/** The test cities a user can choose, each in its own zone. */
export const RIYADH_CITY: ManualLocation = {
  cityId: 108410,
  name: "Riyadh",
  names: { ar: "الرياض", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: SAUDI_ARABIA,
  ...RIYADH_COORDS,
  timezone: RIYADH_ZONE,
};

export const MAKKAH_CITY: ManualLocation = {
  ...RIYADH_CITY,
  cityId: 104515,
  name: "Makkah",
  names: { ar: "مكة المكرمة", ur: null, ms: null },
  latitude: 21.4225,
  longitude: 39.8262,
};

export const JEDDAH_CITY: ManualLocation = {
  ...RIYADH_CITY,
  cityId: 105343,
  name: "Jeddah",
  names: { ar: "جدة", ur: null, ms: null },
  latitude: 21.54238,
  longitude: 39.19797,
};

export const DUBAI_ZONE = "Asia/Dubai";

export const DUBAI_CITY: ManualLocation = {
  cityId: 292223,
  name: "Dubai",
  names: { ar: "دبي", ur: null, ms: null },
  region: null,
  countryCode: "AE",
  country: { name: "United Arab Emirates", names: { ar: "الإمارات", ur: null, ms: null } },
  latitude: 25.07725,
  longitude: 55.30927,
  timezone: DUBAI_ZONE,
};
