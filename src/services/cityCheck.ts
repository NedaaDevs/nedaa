import { AppState } from "react-native";

import { reverseGeocodeAsync, type LocationGeocodedAddress } from "@/adapters/location";
import { APP_STATE } from "@/constants/AppState";
import {
  CACHED_FIX_MAX_AGE_MS,
  CHECK_MAX_TURNS,
  CHECK_THROTTLE_MS,
  CITY_CHECK_END,
  CITY_CHECK_NEED,
  CITY_CHECK_SKIP,
  CITY_CHECK_TRIGGER,
  CONFIRM_FIX_DELAY_MS,
  FRESH_FIX_TIMEOUT_MS,
  MEMORY_LOAD_TIMEOUT_MS,
  type CityCheckEnd,
  type CityCheckOfferReason,
  type CityCheckReason,
  type CityCheckTrigger,
} from "@/constants/CityCheck";
import {
  FIX_SOURCE,
  LOCATION_FAILURE,
  METERS_PER_KM,
  knownPlaceName,
  type FixSource,
} from "@/constants/Location";
import { ASR_SCHOOL } from "@/constants/providers";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { CitiesDB } from "@/services/cities-db";
import { useAppStore } from "@/stores/app";
import { useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { isRunning, useLocationUpdateStore } from "@/stores/locationUpdate";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import type {
  CityCandidate,
  CityCheckFacts,
  CityCheckFix,
  CityCheckVerdict,
  MethodFacts,
  SavedPlaceFacts,
  ShiftCalc,
} from "@/types/cityCheck";
import type { Coords, LocationObject } from "@/types/location";
import type { AladhanSettings } from "@/types/providers/aladhan";
import { APP_LEFT, unlessLeft, waitWhileActive } from "@/utils/appForeground";
import { AppLogger } from "@/utils/appLogger";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";
import { confirmedFix, isNearSaved, judgeCityChange } from "@/utils/cityCheck/judge";
import { countryCodeOf, keptAfterFix } from "@/utils/cityCheck/marks";
import { providerMethodAt } from "@/utils/cityCheck/method";
import {
  guardReason,
  shouldStartCheck,
  staleOffer,
  type GuardFacts,
} from "@/utils/cityCheck/trigger";
import {
  distanceBetween,
  LocationPermissionError,
  locationFailureOf,
  readCachedFix,
  readPassiveFix,
} from "@/utils/location";
import { readPhoneZone } from "@/utils/phoneZone";
import { waitForHydration } from "@/utils/storeHydration";

// Every log line holds codes only: never a name, a point or an error's text.
const log = AppLogger.create("location");
const TAG = "CityCheck";

/** A first fix waiting for its confirmation, for the place at `revision`. */
type PendingFix = { fix: CityCheckFix; revision: number };

/** How a check ends: the offer's reasons, or why there is none. */
export type CheckEnd = { offered: CityCheckOfferReason[] } | { reason: CityCheckReason };

/** A running check, and the count of leaves when it began. */
type Flight = { run: Promise<CheckEnd>; leaves: number };

let inFlight: Flight | null = null;
let followUp: Promise<CheckEnd> | null = null;
let pendingFix: PendingFix | null = null;
let leftAt: number | null = null;
let leaves = 0;
let launchOwed = false;

/** When the app last went to the background. */
export const markAppLeft = (at: number): void => {
  leftAt = at;
  leaves += 1;
};

// Each return reads the leave once; a return with none counts as not away.
const takeLeftAt = (): number | null => {
  const at = leftAt;
  leftAt = null;
  return at;
};

const ended = (reason: CityCheckReason): CheckEnd => ({ reason });

// Ends that say nothing about the place, so the throttle does not start.
const UNTHROTTLED_ENDS: readonly CityCheckReason[] = [
  CITY_CHECK_END.CONFIRM_DEFERRED,
  CITY_CHECK_END.APP_LEFT,
];
const throttles = (end: CheckEnd): boolean =>
  !("reason" in end && UNTHROTTLED_ENDS.includes(end.reason));

const isEnd = (verdict: CityCheckVerdict): boolean =>
  verdict.offer || !Object.values<string>(CITY_CHECK_NEED).includes(verdict.reason);

const toFix = ({ coords, timestamp }: LocationObject, source: FixSource): CityCheckFix => ({
  point: { latitude: coords.latitude, longitude: coords.longitude },
  accuracyKm: coords.accuracy === null ? null : coords.accuracy / METERS_PER_KM,
  fixedAt: timestamp,
  source,
});

const memoryLoaded = async (): Promise<boolean> => {
  let loaded = true;
  const onTimeout = () => {
    loaded = false;
  };
  await Promise.all(
    [
      useLocationStore.persist,
      useCityCheckStore.persist,
      useProviderSettingsStore.persist,
      useAppStore.persist,
    ].map((persist) => waitForHydration(persist, { timeoutMs: MEMORY_LOAD_TIMEOUT_MS, onTimeout }))
  );
  return loaded;
};

const guardFacts = (): GuardFacts => {
  const place = useLocationStore.getState();
  return {
    travelMode: place.travelMode,
    locationMode: place.locationMode,
    isFirstRun: useAppStore.getState().isFirstRun,
    screenshotMode: IS_SCREENSHOT_MODE,
    appActive: AppState.currentState === APP_STATE.ACTIVE,
    offerShowing: place.cityOffer !== null,
    updateRunning: isRunning(useLocationUpdateStore.getState().run),
    hasSavedPlace: place.lastKnownCoords !== null && Boolean(place.locationDetails.timezone),
  };
};

// The app's own state is checked by the waits, not here: a read may outlast it.
const interruption = (revision: number): CityCheckReason | null =>
  guardReason({ ...guardFacts(), appActive: true }) ??
  (useLocationStore.getState().placeRevision === revision ? null : CITY_CHECK_END.PLACE_CHANGED);

const savedFacts = (point: Coords): SavedPlaceFacts => {
  const { locationDetails } = useLocationStore.getState();
  const accuracyM = locationDetails.coords.accuracy;
  return {
    point,
    accuracyKm: accuracyM === null ? null : accuracyM / METERS_PER_KM,
    zone: locationDetails.timezone,
    countryCode: locationDetails.countryCode,
  };
};

type FreshRead = { fix: CityCheckFix } | { end: CityCheckEnd };

const readFresh = async (): Promise<FreshRead> => {
  try {
    return { fix: toFix(await readPassiveFix(FRESH_FIX_TIMEOUT_MS), FIX_SOURCE.FRESH) };
  } catch (error) {
    if (error instanceof LocationPermissionError) return { end: CITY_CHECK_END.NO_PERMISSION };
    return locationFailureOf(error) === LOCATION_FAILURE.SERVICES_OFF
      ? { end: CITY_CHECK_END.SERVICES_OFF }
      : { end: CITY_CHECK_END.FIX_FAILED };
  }
};

/** Gathers the facts the judge asks for, one need a turn, until it decides. */
const investigate = async (revision: number): Promise<CheckEnd> => {
  const savedPoint = useLocationStore.getState().lastKnownCoords;
  if (savedPoint === null) return ended(CITY_CHECK_SKIP.NO_SAVED_PLACE);
  let saved = savedFacts(savedPoint);
  const settings = useProviderSettingsStore.getState().getCurrentSettings<AladhanSettings>();
  const { inEffect } = useProviderSettingsStore.getState();
  const userMethod = settings?.method ?? null;
  const savedMethod = () => inEffect?.method ?? providerMethodAt(saved.point, saved.countryCode);
  const school = settings?.madhab ?? inEffect?.madhab ?? ASR_SCHOOL.SHAFI;
  // Derived each turn, so a country the check fills in reaches the estimate.
  const calc = (): ShiftCalc => ({ method: userMethod ?? savedMethod(), school });
  // A method change counts only between known countries; a guess never offers.
  const methodsFor = (candidate: CityCandidate | null): MethodFacts => {
    const savedKnown = inEffect?.method != null || saved.countryCode !== null;
    if (userMethod !== null || !savedKnown || !candidate?.countryCode) return null;
    return {
      saved: savedMethod(),
      candidate: providerMethodAt(candidate.point, candidate.countryCode),
    };
  };

  let fixes: CityCheckFix[] = pendingFix?.revision === revision ? [pendingFix.fix] : [];
  pendingFix = null;
  let candidate: CityCandidate | null = null;
  let countryLooked = false;
  let cachedRead = false;
  let secondRead = false;
  let keptSettled = false;
  let kept = useCityCheckStore.getState().cityCheck.kept;
  const { notAsked } = useCityCheckStore.getState().cityCheck;

  // One device-geocoder call per point per check; a failure names nothing.
  const addresses = new Map<string, Promise<LocationGeocodedAddress | null>>();
  const addressAt = (point: Coords) => {
    const key = `${point.latitude},${point.longitude}`;
    const known = addresses.get(key);
    if (known) return known;
    const lookup = reverseGeocodeAsync(point).then(
      (found) => found[0] ?? null,
      () => {
        log.w(TAG, "device geocoder failed");
        return null;
      }
    );
    addresses.set(key, lookup);
    return lookup;
  };
  const countryAt = async (point: Coords): Promise<string | null> => {
    const row = CitiesDB.isFullPackInstalled() ? await trustedCityNear(point) : null;
    if (row) return countryCodeOf(row.countryCode);
    return countryCodeOf((await addressAt(point))?.isoCountryCode);
  };

  const facts = (): CityCheckFacts => ({
    now: Date.now(),
    saved,
    fixes,
    candidate,
    countryLooked,
    methods: methodsFor(candidate),
    calc: calc(),
    kept,
    notAsked,
  });

  // The facts the judge needs; an end when one cannot be had.
  const gather = async (need: CityCheckReason): Promise<CheckEnd | null> => {
    switch (need) {
      case CITY_CHECK_NEED.NEEDS_FRESH_FIX: {
        if (!cachedRead) {
          cachedRead = true;
          const cached = await unlessLeft(() => readCachedFix(CACHED_FIX_MAX_AGE_MS));
          if (cached === APP_LEFT) return ended(CITY_CHECK_END.APP_LEFT);
          if (cached) fixes = [...fixes, toFix(cached, FIX_SOURCE.LAST_KNOWN)];
          return null;
        }
        const read = await unlessLeft(readFresh);
        if (read === APP_LEFT) return ended(CITY_CHECK_END.APP_LEFT);
        if ("end" in read) return ended(read.end);
        fixes = [...fixes, read.fix];
        return null;
      }
      case CITY_CHECK_NEED.NEEDS_SECOND_FIX: {
        const first = fixes.find((fix) => fix.source === FIX_SOURCE.FRESH);
        if (!first) return ended(CITY_CHECK_END.CHECK_FAILED);
        // A second read that still confirms nothing waits for the next return.
        const defer = () => {
          pendingFix = { fix: first, revision };
          return ended(CITY_CHECK_END.CONFIRM_DEFERRED);
        };
        if (secondRead) return defer();
        secondRead = true;
        const rest = Math.max(0, CONFIRM_FIX_DELAY_MS - (Date.now() - first.fixedAt));
        if (!(await waitWhileActive(rest))) return defer();
        const stop = interruption(revision);
        if (stop) return ended(stop);
        const read = await readFresh();
        if ("end" in read) return ended(read.end);
        fixes = [...fixes, read.fix];
        return null;
      }
      case CITY_CHECK_NEED.NEEDS_CANDIDATE: {
        const fix = confirmedFix(fixes);
        if (!fix) return ended(CITY_CHECK_END.CHECK_FAILED);
        const row = await trustedCityNear(fix.point);
        candidate = {
          point: fix.point,
          accuracyKm: fix.accuracyKm,
          fixedAt: fix.fixedAt,
          zone: row?.timezone ?? null,
          countryCode:
            row && CitiesDB.isFullPackInstalled() ? countryCodeOf(row.countryCode) : null,
          name: row ? { name: row.name, names: row.names } : null,
          distanceKm: distanceBetween(saved.point, fix.point),
        };
        return null;
      }
      case CITY_CHECK_NEED.NEEDS_COUNTRY: {
        countryLooked = true;
        if (saved.countryCode === null) {
          const code = await countryAt(saved.point);
          if (code) {
            saved = { ...saved, countryCode: code };
            useLocationStore.getState().rememberCountryCode(code, revision);
          }
        }
        const current = candidate;
        if (current && current.countryCode === null) {
          candidate = { ...current, countryCode: await countryAt(current.point) };
        }
        return null;
      }
      default:
        return ended(CITY_CHECK_END.CHECK_FAILED);
    }
  };

  // A confirmed fix ends kept trips once. Its country is the candidate's, or
  // the saved place's for a fix at home.
  const settleKept = () => {
    const confirmed = confirmedFix(fixes);
    if (keptSettled || !confirmed) return false;
    keptSettled = true;
    const before = useCityCheckStore.getState().cityCheck.kept;
    const home = isNearSaved(confirmed, saved) ? saved.countryCode : null;
    const country = candidate?.countryCode ?? home;
    kept = keptAfterFix(before, confirmed, saved.zone, calc(), Date.now(), country);
    if (kept.length !== before.length) useCityCheckStore.getState().setKept(kept);
    return true;
  };

  // Names an unnamed candidate from the device geocoder, then makes the offer.
  const offer = async (
    found: CityCandidate,
    reasons: CityCheckOfferReason[]
  ): Promise<CheckEnd> => {
    let named = found;
    if (!named.name) {
      const city = knownPlaceName((await addressAt(named.point))?.city);
      if (city) named = { ...named, name: { name: city, names: null } };
    }
    const stop = interruption(revision);
    if (stop) return ended(stop);
    useLocationStore.getState().offerCity(named, reasons);
    return { offered: reasons };
  };

  for (let turn = 0; turn < CHECK_MAX_TURNS; turn++) {
    let verdict = judgeCityChange(facts());
    if (isEnd(verdict) && settleKept()) verdict = judgeCityChange(facts());
    if (verdict.offer) return offer(verdict.candidate, verdict.reasons);
    if (isEnd(verdict)) return ended(verdict.reason);
    const end = await gather(verdict.reason);
    if (end) return end;
    const stop = interruption(revision);
    if (stop) return ended(stop);
  }
  return ended(CITY_CHECK_END.CHECK_FAILED);
};

const endLine = (trigger: CityCheckTrigger, end: CheckEnd) =>
  "offered" in end ? `${trigger} → offer (${end.offered.join(",")})` : `${trigger} → ${end.reason}`;

const checkOnce = async (trigger: CityCheckTrigger): Promise<CheckEnd> => {
  const away = trigger === CITY_CHECK_TRIGGER.RETURN ? takeLeftAt() : null;
  let started = false;
  const finish = (end: CheckEnd): CheckEnd => {
    log.i(TAG, endLine(trigger, end));
    if (started && throttles(end)) useCityCheckStore.getState().noteCheckFinished(Date.now());
    return end;
  };
  try {
    if (!(await memoryLoaded())) return finish(ended(CITY_CHECK_SKIP.MEMORY_NOT_LOADED));

    const now = Date.now();
    const { cityOffer, placeRevision } = useLocationStore.getState();
    if (staleOffer(cityOffer?.candidate.fixedAt ?? null, now)) {
      useLocationStore.getState().dismissCityOffer();
      log.i(TAG, "stale offer dropped");
    }

    const guard = guardReason(guardFacts());
    if (guard === CITY_CHECK_SKIP.APP_NOT_ACTIVE && trigger === CITY_CHECK_TRIGGER.LAUNCH)
      launchOwed = true;
    if (guard) return finish(ended(guard));

    // A deferred fix a throttle window old confirms nothing.
    if (pendingFix && now - pendingFix.fix.fixedAt > CHECK_THROTTLE_MS) pendingFix = null;
    const phoneZone = readPhoneZone();
    const { lastCheckAt, lastPhoneZone } = useCityCheckStore.getState().cityCheck;
    const skip = shouldStartCheck({
      trigger,
      now,
      leftAt: away,
      launchOwed,
      pendingFix: pendingFix?.revision === placeRevision,
      lastCheckAt,
      lastPhoneZone,
      phoneZone,
    });
    if (skip) return finish(ended(skip));

    started = true;
    useCityCheckStore.getState().noteCheckStarted(phoneZone);
    launchOwed = false;
    const end = await investigate(placeRevision);
    // A launch check the app left is owed to the next return.
    const left = "reason" in end && end.reason === CITY_CHECK_END.APP_LEFT;
    if (left && trigger === CITY_CHECK_TRIGGER.LAUNCH) launchOwed = true;
    return finish(end);
  } catch {
    return finish(ended(CITY_CHECK_END.CHECK_FAILED));
  }
};

const startCheck = (trigger: CityCheckTrigger): Promise<CheckEnd> => {
  const run = checkOnce(trigger).finally(() => {
    inFlight = null;
  });
  inFlight = { run, leaves };
  return run;
};

/** Checks whether the phone moved to another city; never rejects. */
export const runCityCheck = (trigger: CityCheckTrigger): Promise<CheckEnd> => {
  if (!inFlight) return startCheck(trigger);
  if (trigger !== CITY_CHECK_TRIGGER.RETURN || leaves === inFlight.leaves) return inFlight.run;
  // A return after a leave the running check began before runs once after it.
  followUp ??= inFlight.run.then(() => {
    followUp = null;
    return runCityCheck(CITY_CHECK_TRIGGER.RETURN);
  });
  return followUp;
};
