import {
  CACHED_FIX_MAX_AGE_MS,
  CITY_CHECK_END,
  CITY_CHECK_NEED,
  CITY_CHECK_OFFER,
  CONFIRM_FIX_DELAY_MS,
  KEPT_MAX_AGE_MS,
  SHIFT_GATE_MINUTES,
} from "@/constants/CityCheck";
import { FIX_SOURCE } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { ASR_SCHOOL } from "@/constants/providers";
import type {
  CityCandidate,
  CityCheckFacts,
  CityCheckFix,
  LocalizedPlaceName,
  ShiftCalc,
} from "@/types/cityCheck";
import type { Coords } from "@/types/location";
import type { MethodId } from "@/types/providers/aladhan";

import { confirmedFix, judgeCityChange } from "@/utils/cityCheck/judge";
import { toPlaceMark } from "@/utils/cityCheck/marks";
import { maxYearlyShiftMinutes } from "@/utils/cityCheck/shift";

const KM_PER_DEGREE = 111.195;
const RAD = Math.PI / 180;
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

const NOW = Date.UTC(2026, 0, 1);
const FIX_ACCURACY_KM = 0.1;
const COARSE_ACCURACY_KM = 3;

const MAKKAH: Coords = { latitude: 21.4225, longitude: 39.8262 };
const JEDDAH: Coords = { latitude: 21.5433, longitude: 39.1728 };
const RIYADH: Coords = { latitude: 24.7136, longitude: 46.6753 };
const DIRIYAH: Coords = { latitude: 24.734, longitude: 46.575 };

const eastOf = (from: Coords, km: number): Coords => ({
  latitude: from.latitude,
  longitude: from.longitude + km / (KM_PER_DEGREE * Math.cos(from.latitude * RAD)),
});

const RIYADH_ZONE = "Asia/Riyadh";
const KUWAIT_ZONE = "Asia/Kuwait";
const SA = COUNTRY_CODE.SAUDI_ARABIA;
const BAHRAIN = "BH";
const UMM_AL_QURA_ID: MethodId = 4;
const GULF_ID: MethodId = 8;
const CALC: ShiftCalc = { method: UMM_AL_QURA_ID, school: ASR_SCHOOL.SHAFI };

const F1_AT = NOW - CONFIRM_FIX_DELAY_MS;

const fresh = (
  point: Coords,
  fixedAt: number = F1_AT,
  accuracyKm: number | null = FIX_ACCURACY_KM
): CityCheckFix => ({ point, accuracyKm, fixedAt, source: FIX_SOURCE.FRESH });
const pair = (point: Coords, accuracyKm: number = FIX_ACCURACY_KM): CityCheckFix[] => [
  fresh(point, F1_AT, accuracyKm),
  fresh(point, NOW, accuracyKm),
];
const cached = (point: Coords, ageMs: number): CityCheckFix => ({
  point,
  accuracyKm: FIX_ACCURACY_KM,
  fixedAt: NOW - ageMs,
  source: FIX_SOURCE.LAST_KNOWN,
});

const named = (name: string): LocalizedPlaceName => ({ name, names: null });

const candidateAt = (
  point: Coords,
  over: Partial<CityCandidate> = {},
  accuracyKm: number = FIX_ACCURACY_KM
): CityCandidate => ({
  point,
  accuracyKm,
  fixedAt: NOW,
  zone: RIYADH_ZONE,
  countryCode: SA,
  name: null,
  distanceKm: 0,
  ...over,
});

const facts = (over: Partial<CityCheckFacts> = {}): CityCheckFacts => ({
  now: NOW,
  saved: { point: MAKKAH, accuracyKm: null, zone: RIYADH_ZONE, countryCode: SA },
  fixes: [],
  candidate: null,
  countryLooked: false,
  methods: null,
  calc: CALC,
  kept: [],
  notAsked: [],
  ...over,
});

const NEAR_HOME = eastOf(MAKKAH, 3);
const JEDDAH_FACTS: Partial<CityCheckFacts> = {
  fixes: pair(JEDDAH),
  candidate: candidateAt(JEDDAH),
};
const jeddahMark = (ageMs: number) => toPlaceMark(JEDDAH, NOW - ageMs);

// Riyadh → Diriyah: a move past the floor with a shift under the gate.
const RIYADH_SAVED = { point: RIYADH, accuracyKm: 0.05, zone: RIYADH_ZONE, countryCode: SA };
const diriyah = (over: Partial<CityCandidate> = {}): Partial<CityCheckFacts> => ({
  saved: RIYADH_SAVED,
  fixes: pair(DIRIYAH),
  candidate: candidateAt(DIRIYAH, over),
});
const expectDiriyahUnderGate = () =>
  expect(maxYearlyShiftMinutes(RIYADH, DIRIYAH, RIYADH_ZONE, CALC, NOW)).toBeLessThan(
    SHIFT_GATE_MINUTES
  );

const verdictOf = (over: Partial<CityCheckFacts>) => judgeCityChange(facts(over));
const reasonOf = (over: Partial<CityCheckFacts>) => {
  const verdict = verdictOf(over);
  return verdict.offer ? null : verdict.reason;
};
const offerReasons = (over: Partial<CityCheckFacts>) => {
  const verdict = verdictOf(over);
  return verdict.offer ? verdict.reasons : null;
};

describe("judgeCityChange", () => {
  describe("evidence", () => {
    it("stops on a cached fix near the saved place", () =>
      expect(reasonOf({ fixes: [cached(NEAR_HOME, 5 * MINUTE_MS)] })).toBe(
        CITY_CHECK_END.NOT_MOVED
      ));

    it("never starts an offer from a cached fix", () =>
      expect(reasonOf({ fixes: [cached(JEDDAH, 5 * MINUTE_MS)] })).toBe(
        CITY_CHECK_NEED.NEEDS_FRESH_FIX
      ));

    it("ignores a cached fix older than 15 minutes", () =>
      expect(reasonOf({ fixes: [cached(NEAR_HOME, CACHED_FIX_MAX_AGE_MS + MINUTE_MS)] })).toBe(
        CITY_CHECK_NEED.NEEDS_FRESH_FIX
      ));

    it("treats jitter as no move", () =>
      expect(
        reasonOf({ saved: RIYADH_SAVED, fixes: [fresh(eastOf(RIYADH, 11), F1_AT, 1.5)] })
      ).toBe(CITY_CHECK_END.NOT_MOVED));

    it("subtracts both accuracies before the 10 km floor", () =>
      expect(
        reasonOf({
          saved: { ...facts().saved, accuracyKm: 0.5 },
          fixes: [fresh(eastOf(MAKKAH, 12), F1_AT, 1)],
        })
      ).toBe(CITY_CHECK_NEED.NEEDS_SECOND_FIX));

    it("takes 2 km for a saved place with no accuracy", () =>
      expect(reasonOf({ fixes: [fresh(eastOf(MAKKAH, 12), F1_AT, 1)] })).toBe(
        CITY_CHECK_END.NOT_MOVED
      ));

    it("cannot confirm a move from a fix with no accuracy", () =>
      expect(reasonOf({ fixes: [fresh(JEDDAH, F1_AT, null)] })).toBe(
        CITY_CHECK_END.FIX_NO_ACCURACY
      ));

    it("asks for a second fix after the first shows a move", () =>
      expect(reasonOf({ fixes: [fresh(JEDDAH)] })).toBe(CITY_CHECK_NEED.NEEDS_SECOND_FIX));

    it("waits for a second fix 30 s after the first", () =>
      expect(
        reasonOf({
          fixes: [fresh(JEDDAH), fresh(JEDDAH, F1_AT + CONFIRM_FIX_DELAY_MS - SECOND_MS)],
        })
      ).toBe(CITY_CHECK_NEED.NEEDS_SECOND_FIX));

    it("drops a move whose two fixes are more than 5 km apart", () =>
      expect(reasonOf({ fixes: [fresh(JEDDAH), fresh(eastOf(JEDDAH, 6.7), NOW)] })).toBe(
        CITY_CHECK_END.FIXES_DISAGREE
      ));

    it("asks for the candidate once two fixes agree", () =>
      expect(reasonOf({ fixes: pair(JEDDAH) })).toBe(CITY_CHECK_NEED.NEEDS_CANDIDATE));
  });

  describe("gate", () => {
    it("offers Makkah → Jeddah on the shift alone", () => {
      expect(maxYearlyShiftMinutes(MAKKAH, JEDDAH, RIYADH_ZONE, CALC, NOW)).toBeGreaterThanOrEqual(
        SHIFT_GATE_MINUTES
      );
      expect(offerReasons(JEDDAH_FACTS)).toEqual([CITY_CHECK_OFFER.SHIFT]);
    });

    it("still offers with Precise off", () =>
      expect(
        verdictOf({
          fixes: pair(JEDDAH, COARSE_ACCURACY_KM),
          candidate: candidateAt(JEDDAH, {}, COARSE_ACCURACY_KM),
        }).offer
      ).toBe(true));

    it.todo("makes no offer for Dammam → Khobar (Asr shifts 1.0 min; gate value pending)");

    it("makes no offer for a move under the shift gate", () => {
      expectDiriyahUnderGate();
      expect(reasonOf(diriyah())).toBe(CITY_CHECK_END.SHIFT_BELOW_GATE);
    });

    it("makes no offer when only the place zone differs", () => {
      expectDiriyahUnderGate();
      expect(reasonOf(diriyah({ zone: KUWAIT_ZONE }))).toBe(CITY_CHECK_END.SHIFT_BELOW_GATE);
    });

    it("offers a country change below the shift gate", () => {
      expectDiriyahUnderGate();
      expect(offerReasons(diriyah({ countryCode: BAHRAIN }))).toEqual([
        CITY_CHECK_OFFER.COUNTRY_CHANGES,
      ]);
    });

    it("reads country codes in any case", () => {
      expectDiriyahUnderGate();
      expect(reasonOf(diriyah({ countryCode: SA.toLowerCase() }))).toBe(
        CITY_CHECK_END.SHIFT_BELOW_GATE
      );
    });

    it("asks for the country when the shift does not decide", () => {
      expectDiriyahUnderGate();
      expect(reasonOf({ ...diriyah({ countryCode: null }), countryLooked: false })).toBe(
        CITY_CHECK_NEED.NEEDS_COUNTRY
      );
    });

    it("makes no offer when the country stays unknown", () => {
      expectDiriyahUnderGate();
      expect(reasonOf({ ...diriyah({ countryCode: null }), countryLooked: true })).toBe(
        CITY_CHECK_END.COUNTRY_UNKNOWN
      );
    });

    it("offers when the provider's method differs", () => {
      expectDiriyahUnderGate();
      expect(
        offerReasons({ ...diriyah(), methods: { saved: UMM_AL_QURA_ID, candidate: GULF_ID } })
      ).toContain(CITY_CHECK_OFFER.METHOD_CHANGES);
    });

    it("adds no reason when the provider's method is the same", () => {
      expectDiriyahUnderGate();
      expect(
        reasonOf({ ...diriyah(), methods: { saved: UMM_AL_QURA_ID, candidate: UMM_AL_QURA_ID } })
      ).toBe(CITY_CHECK_END.SHIFT_BELOW_GATE);
    });
  });

  describe("memory", () => {
    it("makes no offer near a kept place", () =>
      expect(reasonOf({ ...JEDDAH_FACTS, kept: [jeddahMark(DAY_MS)] })).toBe(CITY_CHECK_END.KEPT));

    it("takes a fresh fix over a cached one at home while a trip is kept", () =>
      expect(
        reasonOf({ fixes: [cached(NEAR_HOME, 5 * MINUTE_MS)], kept: [jeddahMark(DAY_MS)] })
      ).toBe(CITY_CHECK_NEED.NEEDS_FRESH_FIX));

    it("takes a fresh pair at home while a trip is kept", () =>
      expect(reasonOf({ fixes: [fresh(NEAR_HOME)], kept: [jeddahMark(DAY_MS)] })).toBe(
        CITY_CHECK_NEED.NEEDS_SECOND_FIX
      ));

    it("ends at home on a confirmed pair while a trip is kept", () =>
      expect(reasonOf({ fixes: pair(NEAR_HOME), kept: [jeddahMark(DAY_MS)] })).toBe(
        CITY_CHECK_END.NOT_MOVED
      ));

    it("stops on a cached fix at home once the kept mark is 31 days old", () =>
      expect(
        reasonOf({ fixes: [cached(NEAR_HOME, 5 * MINUTE_MS)], kept: [jeddahMark(31 * DAY_MS)] })
      ).toBe(CITY_CHECK_END.NOT_MOVED));

    it("offers again near a kept place after 30 days", () =>
      expect(
        verdictOf({ ...JEDDAH_FACTS, kept: [jeddahMark(KEPT_MAX_AGE_MS + DAY_MS)] }).offer
      ).toBe(true));

    it("makes no offer near a place the user muted", () =>
      expect(reasonOf({ ...JEDDAH_FACTS, notAsked: [jeddahMark(DAY_MS)] })).toBe(
        CITY_CHECK_END.NOT_ASKED
      ));
  });

  describe("names", () => {
    it("offers an unnamed candidate", () =>
      expect(
        verdictOf({ ...JEDDAH_FACTS, candidate: candidateAt(JEDDAH, { name: null }) }).offer
      ).toBe(true));

    it("never lets a name decide", () => {
      expectDiriyahUnderGate();
      expect(
        verdictOf({ ...JEDDAH_FACTS, candidate: candidateAt(JEDDAH, { name: named("Makkah") }) })
          .offer
      ).toBe(true);
      expect(reasonOf(diriyah({ name: named("Riyadh") }))).toBe(CITY_CHECK_END.SHIFT_BELOW_GATE);
    });
  });
});

describe("confirmedFix", () => {
  const [f1, f2] = pair(JEDDAH);
  const F2_EARLY = fresh(JEDDAH, F1_AT + CONFIRM_FIX_DELAY_MS - SECOND_MS);
  const F2_FAR = fresh(eastOf(JEDDAH, 6.7), NOW);
  const F2_NO_ACCURACY = fresh(JEDDAH, NOW, null);

  it("confirms the last fresh fix 30 s after the first, within 5 km", () =>
    expect(confirmedFix([f1, f2])).toBe(f2));

  it.each([
    ["29 s after the first", F2_EARLY],
    ["6.7 km away", F2_FAR],
    ["with no accuracy", F2_NO_ACCURACY],
  ])("confirms nothing for a second fix %s", (_case, second) =>
    expect(confirmedFix([f1, second])).toBeNull()
  );

  it("confirms nothing for one fix or a cached pair", () => {
    expect(confirmedFix([f1])).toBeNull();
    expect(
      confirmedFix([
        { ...f1, source: FIX_SOURCE.LAST_KNOWN },
        { ...f2, source: FIX_SOURCE.LAST_KNOWN },
      ])
    ).toBeNull();
  });
});
