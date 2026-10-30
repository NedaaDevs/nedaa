import {
  CHECK_MIN_AWAY_MS,
  CHECK_THROTTLE_MS,
  CITY_CHECK_SKIP,
  CITY_CHECK_TRIGGER,
  TRAVEL_MODE,
  type CityCheckSkip,
  type CityCheckTrigger,
  type TravelMode,
} from "@/constants/CityCheck";
import { LocationMode, type LocationModeValue } from "@/enums/location";

export type GuardFacts = {
  travelMode: TravelMode;
  locationMode: LocationModeValue;
  isFirstRun: boolean;
  screenshotMode: boolean;
  appActive: boolean;
  offerShowing: boolean;
  updateRunning: boolean;
  hasSavedPlace: boolean;
};

export type TriggerFacts = {
  trigger: CityCheckTrigger;
  now: number;
  leftAt: number | null;
  launchOwed: boolean;
  pendingFix: boolean;
  lastCheckAt: number | null;
  lastPhoneZone: string | null;
  phoneZone: string | null;
};

// The first guard that fails, in a fixed order; null lets the check go on.
export const guardReason = (facts: GuardFacts): CityCheckSkip | null => {
  if (facts.travelMode === TRAVEL_MODE.OFF) return CITY_CHECK_SKIP.TRAVEL_OFF;
  if (facts.locationMode === LocationMode.MANUAL) return CITY_CHECK_SKIP.MANUAL_MODE;
  if (facts.isFirstRun) return CITY_CHECK_SKIP.FIRST_RUN;
  if (facts.screenshotMode) return CITY_CHECK_SKIP.SCREENSHOT_MODE;
  if (!facts.appActive) return CITY_CHECK_SKIP.APP_NOT_ACTIVE;
  if (facts.offerShowing) return CITY_CHECK_SKIP.OFFER_SHOWING;
  if (facts.updateRunning) return CITY_CHECK_SKIP.UPDATE_RUNNING;
  if (!facts.hasSavedPlace) return CITY_CHECK_SKIP.NO_SAVED_PLACE;
  return null;
};

// An unknown zone on either side counts as unchanged.
const zoneChanged = (facts: TriggerFacts) =>
  facts.lastPhoneZone !== null &&
  facts.phoneZone !== null &&
  facts.lastPhoneZone !== facts.phoneZone;

const awayTooShort = (facts: TriggerFacts) =>
  facts.launchOwed ? false : facts.leftAt === null || facts.now - facts.leftAt < CHECK_MIN_AWAY_MS;

const throttled = (facts: TriggerFacts) =>
  facts.lastCheckAt !== null &&
  facts.now - facts.lastCheckAt < CHECK_THROTTLE_MS &&
  !zoneChanged(facts);

// On a return, a fix waiting for confirmation skips the away and throttle rules.
export const shouldStartCheck = (facts: TriggerFacts): CityCheckSkip | null => {
  if (facts.trigger === CITY_CHECK_TRIGGER.RETURN) {
    if (facts.pendingFix) return null;
    if (awayTooShort(facts)) return CITY_CHECK_SKIP.AWAY_TOO_SHORT;
  }
  return throttled(facts) ? CITY_CHECK_SKIP.THROTTLED : null;
};

// An offer whose candidate fix is a throttle window old no longer counts as showing.
export const staleOffer = (offerFixedAt: number | null, now: number): boolean =>
  offerFixedAt !== null && now - offerFixedAt >= CHECK_THROTTLE_MS;
