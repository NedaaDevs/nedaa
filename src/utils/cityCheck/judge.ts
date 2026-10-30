import {
  CACHED_FIX_MAX_AGE_MS,
  CITY_CHECK_END,
  CITY_CHECK_NEED,
  CITY_CHECK_OFFER,
  CONFIRM_FIX_AGREE_KM,
  CONFIRM_FIX_DELAY_MS,
  MOVE_MIN_KM,
  SHIFT_GATE_MINUTES,
  type CityCheckEnd,
  type CityCheckOfferReason,
} from "@/constants/CityCheck";
import { FIX_SOURCE } from "@/constants/Location";
import type {
  CityCandidate,
  CityCheckFacts,
  CityCheckFix,
  CityCheckVerdict,
  PlaceMark,
  SavedPlaceFacts,
} from "@/types/cityCheck";
import type { Coords } from "@/types/location";
import { conservativeKm, isLiveKept, matchesMark, sameCountry } from "@/utils/cityCheck/marks";
import { maxYearlyShiftMinutes } from "@/utils/cityCheck/shift";
import { calculateDistance } from "@/utils/location";

const distanceKm = (a: Coords, b: Coords) =>
  calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);

const freshFixes = (fixes: readonly CityCheckFix[]) =>
  fixes.filter((fix) => fix.source === FIX_SOURCE.FRESH);

/** Whether a fix lies within the move floor of the saved place. */
export const isNearSaved = (fix: CityCheckFix, saved: SavedPlaceFacts): boolean =>
  conservativeKm(fix.point, fix.accuracyKm, saved.point, saved.accuracyKm) <= MOVE_MIN_KM;

const confirms = (first: CityCheckFix, last: CityCheckFix) =>
  last.fixedAt - first.fixedAt >= CONFIRM_FIX_DELAY_MS &&
  first.accuracyKm !== null &&
  last.accuracyKm !== null &&
  distanceKm(first.point, last.point) <= CONFIRM_FIX_AGREE_KM;

/** The last fresh fix when it confirms the first; else null. */
export const confirmedFix = (fixes: readonly CityCheckFix[]): CityCheckFix | null => {
  const fresh = freshFixes(fixes);
  if (fresh.length < 2) return null;
  const first = fresh[0];
  const last = fresh[fresh.length - 1];
  return confirms(first, last) ? last : null;
};

const offerReasons = (facts: CityCheckFacts, candidate: CityCandidate): CityCheckOfferReason[] => {
  const { saved, methods, calc, now } = facts;
  const shift = maxYearlyShiftMinutes(saved.point, candidate.point, saved.zone, calc, now);
  const countryChanges =
    saved.countryCode !== null &&
    candidate.countryCode !== null &&
    !sameCountry(saved.countryCode, candidate.countryCode);
  return [
    ...(methods && methods.saved !== methods.candidate ? [CITY_CHECK_OFFER.METHOD_CHANGES] : []),
    ...(shift >= SHIFT_GATE_MINUTES ? [CITY_CHECK_OFFER.SHIFT] : []),
    ...(countryChanges ? [CITY_CHECK_OFFER.COUNTRY_CHANGES] : []),
  ];
};

// The end a remembered place gives a point: muted first, then a live kept trip.
const markEnd = (
  { kept, notAsked, now }: CityCheckFacts,
  point: Coords,
  accuracyKm: number | null
): CityCheckEnd | null => {
  const matches = (mark: PlaceMark) => matchesMark(point, accuracyKm, mark);
  if (notAsked.some(matches)) return CITY_CHECK_END.NOT_ASKED;
  if (kept.some((entry) => isLiveKept(entry, now) && matches(entry))) return CITY_CHECK_END.KEPT;
  return null;
};

// The gate, once a confirmed move and a candidate are known.
const judgeCandidate = (facts: CityCheckFacts, candidate: CityCandidate): CityCheckVerdict => {
  const { saved, countryLooked } = facts;
  const remembered = markEnd(facts, candidate.point, candidate.accuracyKm);
  if (remembered) return { offer: false, reason: remembered };

  const reasons = offerReasons(facts, candidate);
  if (reasons.length > 0) return { offer: true, candidate, reasons };
  if (saved.countryCode !== null && candidate.countryCode !== null)
    return { offer: false, reason: CITY_CHECK_END.SHIFT_BELOW_GATE };
  return {
    offer: false,
    reason: countryLooked ? CITY_CHECK_END.COUNTRY_UNKNOWN : CITY_CHECK_NEED.NEEDS_COUNTRY,
  };
};

/** The next step of a city check; the first rule that answers wins. */
export const judgeCityChange = (facts: CityCheckFacts): CityCheckVerdict => {
  const { fixes, saved, kept, now, candidate } = facts;
  const tripKept = kept.some((entry) => isLiveKept(entry, now));
  const fresh = freshFixes(fixes);

  if (fresh.length === 0) {
    const last = fixes.at(-1);
    const cachedAtHome =
      last !== undefined &&
      now - last.fixedAt <= CACHED_FIX_MAX_AGE_MS &&
      isNearSaved(last, saved) &&
      !tripKept;
    return cachedAtHome
      ? { offer: false, reason: CITY_CHECK_END.NOT_MOVED }
      : { offer: false, reason: CITY_CHECK_NEED.NEEDS_FRESH_FIX };
  }

  const first = fresh[0];
  if (first.accuracyKm === null) return { offer: false, reason: CITY_CHECK_END.FIX_NO_ACCURACY };
  // A remembered place ends the check on one fresh fix; it never needs a second.
  const remembered = markEnd(facts, first.point, first.accuracyKm);
  if (remembered) return { offer: false, reason: remembered };
  if (isNearSaved(first, saved) && !tripKept)
    return { offer: false, reason: CITY_CHECK_END.NOT_MOVED };
  if (fresh.length === 1) return { offer: false, reason: CITY_CHECK_NEED.NEEDS_SECOND_FIX };

  const last = fresh[fresh.length - 1];
  if (last.fixedAt - first.fixedAt < CONFIRM_FIX_DELAY_MS)
    return { offer: false, reason: CITY_CHECK_NEED.NEEDS_SECOND_FIX };
  if (last.accuracyKm === null) return { offer: false, reason: CITY_CHECK_END.FIX_NO_ACCURACY };
  if (distanceKm(first.point, last.point) > CONFIRM_FIX_AGREE_KM)
    return { offer: false, reason: CITY_CHECK_END.FIXES_DISAGREE };
  if (isNearSaved(last, saved)) return { offer: false, reason: CITY_CHECK_END.NOT_MOVED };

  if (!candidate) return { offer: false, reason: CITY_CHECK_NEED.NEEDS_CANDIDATE };
  return judgeCandidate(facts, candidate);
};
