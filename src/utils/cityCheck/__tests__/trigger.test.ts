import {
  CHECK_MIN_AWAY_MS,
  CHECK_THROTTLE_MS,
  CITY_CHECK_SKIP,
  CITY_CHECK_TRIGGER,
  TRAVEL_MODE,
} from "@/constants/CityCheck";
import { LocationMode } from "@/enums/location";
import {
  guardReason,
  shouldStartCheck,
  staleOffer,
  type GuardFacts,
  type TriggerFacts,
} from "@/utils/cityCheck/trigger";

const MINUTE_MS = 60_000;
const NOW = 1_000_000_000_000;
const ZONE_RIYADH = "Asia/Riyadh";
const ZONE_DUBAI = "Asia/Dubai";

const openGuards: GuardFacts = {
  travelMode: TRAVEL_MODE.ASK,
  locationMode: LocationMode.DEVICE,
  isFirstRun: false,
  screenshotMode: false,
  appActive: true,
  offerShowing: false,
  updateRunning: false,
  hasSavedPlace: true,
};

const launchFacts = (over: Partial<TriggerFacts> = {}): TriggerFacts => ({
  trigger: CITY_CHECK_TRIGGER.LAUNCH,
  now: NOW,
  leftAt: null,
  launchOwed: false,
  pendingFix: false,
  lastCheckAt: null,
  lastPhoneZone: null,
  phoneZone: null,
  ...over,
});

const returnFacts = (over: Partial<TriggerFacts> = {}): TriggerFacts =>
  launchFacts({ trigger: CITY_CHECK_TRIGGER.RETURN, leftAt: NOW - CHECK_MIN_AWAY_MS, ...over });

describe("guardReason", () => {
  it("passes when every guard is open", () => {
    expect(guardReason(openGuards)).toBeNull();
  });

  it.each([
    ["skips with travel off", { travelMode: TRAVEL_MODE.OFF }, CITY_CHECK_SKIP.TRAVEL_OFF],
    ["skips in manual mode", { locationMode: LocationMode.MANUAL }, CITY_CHECK_SKIP.MANUAL_MODE],
    ["skips on the first run", { isFirstRun: true }, CITY_CHECK_SKIP.FIRST_RUN],
    ["skips in screenshot mode", { screenshotMode: true }, CITY_CHECK_SKIP.SCREENSHOT_MODE],
    ["skips while the app is not active", { appActive: false }, CITY_CHECK_SKIP.APP_NOT_ACTIVE],
    ["skips while an offer shows", { offerShowing: true }, CITY_CHECK_SKIP.OFFER_SHOWING],
    ["skips while an update runs", { updateRunning: true }, CITY_CHECK_SKIP.UPDATE_RUNNING],
    ["skips with no saved place", { hasSavedPlace: false }, CITY_CHECK_SKIP.NO_SAVED_PLACE],
  ] as const)("%s", (_name, over, expected) => {
    expect(guardReason({ ...openGuards, ...over })).toBe(expected);
  });

  it("reports the first failing guard in order", () => {
    expect(
      guardReason({
        ...openGuards,
        travelMode: TRAVEL_MODE.OFF,
        hasSavedPlace: false,
        appActive: false,
      })
    ).toBe(CITY_CHECK_SKIP.TRAVEL_OFF);
    expect(guardReason({ ...openGuards, appActive: false, hasSavedPlace: false })).toBe(
      CITY_CHECK_SKIP.APP_NOT_ACTIVE
    );
  });
});

describe("shouldStartCheck", () => {
  it("starts a launch check 30 min after the last", () => {
    expect(shouldStartCheck(launchFacts({ lastCheckAt: NOW - CHECK_THROTTLE_MS }))).toBeNull();
  });

  it("skips a launch check inside the throttle", () => {
    expect(shouldStartCheck(launchFacts({ lastCheckAt: NOW - 29 * MINUTE_MS }))).toBe(
      CITY_CHECK_SKIP.THROTTLED
    );
  });

  it("starts inside the throttle when the phone zone changed", () => {
    expect(
      shouldStartCheck(
        launchFacts({
          lastCheckAt: NOW - MINUTE_MS,
          lastPhoneZone: ZONE_RIYADH,
          phoneZone: ZONE_DUBAI,
        })
      )
    ).toBeNull();
  });

  it("treats an unknown phone zone as unchanged", () => {
    expect(
      shouldStartCheck(
        launchFacts({ lastCheckAt: NOW - MINUTE_MS, lastPhoneZone: ZONE_RIYADH, phoneZone: null })
      )
    ).toBe(CITY_CHECK_SKIP.THROTTLED);
  });

  it("skips a return after less than 5 min away", () => {
    expect(shouldStartCheck(returnFacts({ leftAt: NOW - 4 * MINUTE_MS }))).toBe(
      CITY_CHECK_SKIP.AWAY_TOO_SHORT
    );
  });

  it("skips a short return even when the zone changed", () => {
    expect(
      shouldStartCheck(
        returnFacts({
          leftAt: NOW - 2 * MINUTE_MS,
          lastCheckAt: NOW - MINUTE_MS,
          lastPhoneZone: ZONE_RIYADH,
          phoneZone: ZONE_DUBAI,
        })
      )
    ).toBe(CITY_CHECK_SKIP.AWAY_TOO_SHORT);
  });

  it("skips a return after 5 min away inside the throttle", () => {
    expect(
      shouldStartCheck(
        returnFacts({ leftAt: NOW - 5 * MINUTE_MS, lastCheckAt: NOW - 10 * MINUTE_MS })
      )
    ).toBe(CITY_CHECK_SKIP.THROTTLED);
  });

  it("starts a return inside the throttle when the zone changed", () => {
    expect(
      shouldStartCheck(
        returnFacts({
          leftAt: NOW - 5 * MINUTE_MS,
          lastCheckAt: NOW - 10 * MINUTE_MS,
          lastPhoneZone: ZONE_RIYADH,
          phoneZone: ZONE_DUBAI,
        })
      )
    ).toBeNull();
  });

  it("starts a return at once for a fix that waits for confirmation", () => {
    expect(
      shouldStartCheck(
        returnFacts({
          pendingFix: true,
          leftAt: NOW - MINUTE_MS,
          lastCheckAt: NOW - MINUTE_MS,
        })
      )
    ).toBeNull();
  });

  it("starts the first return of a launch that ran in the background", () => {
    expect(shouldStartCheck(returnFacts({ launchOwed: true, leftAt: null }))).toBeNull();
  });

  it("skips a return with no recorded leave", () => {
    expect(shouldStartCheck(returnFacts({ launchOwed: false, leftAt: null }))).toBe(
      CITY_CHECK_SKIP.AWAY_TOO_SHORT
    );
  });
});

describe("staleOffer", () => {
  it("drops an offer whose fix is 30 min old", () => {
    expect(staleOffer(NOW - 30 * MINUTE_MS, NOW)).toBe(true);
  });

  it("keeps an offer whose fix is 29 min old", () => {
    expect(staleOffer(NOW - 29 * MINUTE_MS, NOW)).toBe(false);
  });

  it("has nothing to drop without an offer", () => {
    expect(staleOffer(null, NOW)).toBe(false);
  });
});
