import { CITY_CHECK_OFFER } from "@/constants/CityCheck";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { useLocationStore } from "@/stores/location";
import { JEDDAH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { CityCandidate } from "@/types/cityCheck";

const FIX_ACCURACY_KM = 0.1;
// Riyadh to Jeddah, as the crow flies.
const RIYADH_TO_JEDDAH_KM = 845;

/** A confirmed move to Jeddah, named from its city row. */
export const candidateAt = (overrides: Partial<CityCandidate> = {}): CityCandidate => ({
  point: { latitude: 21.5433, longitude: 39.1728 },
  accuracyKm: FIX_ACCURACY_KM,
  fixedAt: Date.now(),
  zone: RIYADH_ZONE,
  countryCode: COUNTRY_CODE.SAUDI_ARABIA,
  name: { name: JEDDAH_CITY.name, names: JEDDAH_CITY.names },
  distanceKm: RIYADH_TO_JEDDAH_KM,
  ...overrides,
});

/** Puts an offer up for `candidate`, on the shift alone. */
export const offerUp = (candidate: CityCandidate = candidateAt()): void =>
  useLocationStore.getState().offerCity(candidate, [CITY_CHECK_OFFER.SHIFT]);
