import { KEPT_MAX, KEPT_MAX_AGE_MS, MOVE_MIN_KM, SHIFT_GATE_MINUTES } from "@/constants/CityCheck";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { FIX_SOURCE } from "@/constants/Location";
import { ASR_SCHOOL } from "@/constants/providers";
import type { CityCheckFix, PlaceMark, ShiftCalc } from "@/types/cityCheck";
import { eastOf } from "@/test-helpers/geo";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { Coords } from "@/types/location";
import type { MethodId } from "@/types/providers/aladhan";

import {
  conservativeKm,
  isLiveKept,
  keptAfterFix,
  markPoint,
  matchesMark,
  toPlaceMark,
  withMark,
} from "@/utils/cityCheck/marks";
import { maxYearlyShiftMinutes } from "@/utils/cityCheck/shift";

const RIYADH: Coords = { latitude: 24.7136, longitude: 46.6753 };
const EAST_12KM = eastOf(RIYADH, 12);
const EAST_15KM = eastOf(RIYADH, 15);
const MAKKAH: Coords = { latitude: 21.4225, longitude: 39.8262 };
const JEDDAH: Coords = { latitude: 21.5433, longitude: 39.1728 };
const JEDDAH_2 = eastOf(JEDDAH, 3);
const MANAMA: Coords = { latitude: 26.2285, longitude: 50.586 };
// A Saudi point close enough to Manama that the shift stays under the gate.
const SAUDI_NEAR_MANAMA: Coords = { latitude: 26.2794, longitude: 50.3 };
const DUBAI: Coords = { latitude: 25.2048, longitude: 55.2708 };

const UMM_AL_QURA_ID: MethodId = 4;
const UMM_AL_QURA: ShiftCalc = { method: UMM_AL_QURA_ID, school: ASR_SCHOOL.SHAFI };
const NOW = Date.UTC(2026, 9, 29, 9);
const FIX_ACCURACY_KM = 1;

const BAHRAIN = COUNTRY_CODE.BAHRAIN;
const mark = (point: Coords, at: number = NOW, countryCode?: string): PlaceMark =>
  toPlaceMark(point, at, countryCode);
const fresh = (point: Coords): CityCheckFix => ({
  point,
  accuracyKm: FIX_ACCURACY_KM,
  fixedAt: NOW,
  source: FIX_SOURCE.FRESH,
});
const cached = (point: Coords): CityCheckFix => ({
  ...fresh(point),
  source: FIX_SOURCE.LAST_KNOWN,
});

describe("place marks", () => {
  it("rounds a point to 0.01°", () => {
    expect(toPlaceMark({ latitude: 21.54329, longitude: 39.17283 }, 1000)).toEqual({
      lat: 21.54,
      lng: 39.17,
      at: 1000,
    });
    expect(toPlaceMark({ latitude: -6.20876, longitude: 106.84559 }, 1)).toEqual({
      lat: -6.21,
      lng: 106.85,
      at: 1,
    });
  });

  it("subtracts both accuracies from the distance", () =>
    expect(conservativeKm(RIYADH, 1, EAST_12KM, 0.5)).toBeCloseTo(10.5, 1));

  it("takes 2 km for a place with no accuracy", () =>
    expect(conservativeKm(RIYADH, 1, EAST_12KM, null)).toBeCloseTo(9, 1));

  it("takes 0 km for a fix with no accuracy", () =>
    expect(conservativeKm(RIYADH, null, EAST_12KM, 0.5)).toBeCloseTo(11.5, 1));

  it("reads a mark as a point", () =>
    expect(markPoint({ lat: 21.54, lng: 39.17, at: 1 })).toEqual({
      latitude: 21.54,
      longitude: 39.17,
    }));

  it("does not match a fix 15 km from a mark with a 1 km accuracy", () =>
    expect(matchesMark(EAST_15KM, 1, mark(RIYADH))).toBe(false));

  it("matches a coarse fix whose accuracy covers the gap", () =>
    expect(matchesMark(EAST_15KM, 4, mark(RIYADH))).toBe(true));

  it("ends a kept trip once a fresh fix back home is past the gate", () =>
    expect(
      keptAfterFix([mark(JEDDAH)], fresh(MAKKAH), RIYADH_ZONE, UMM_AL_QURA, NOW, null)
    ).toEqual([]));

  it("keeps a kept trip on a cached fix", () =>
    expect(
      keptAfterFix([mark(JEDDAH)], cached(MAKKAH), RIYADH_ZONE, UMM_AL_QURA, NOW, null)
    ).toHaveLength(1));

  it("keeps a kept trip on a fresh fix with no accuracy", () =>
    expect(
      keptAfterFix(
        [mark(JEDDAH)],
        { ...fresh(MAKKAH), accuracyKm: null },
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW,
        null
      )
    ).toHaveLength(1));

  it("keeps a kept trip while the fix stays near it", () =>
    expect(
      keptAfterFix([mark(JEDDAH)], fresh(JEDDAH_2), RIYADH_ZONE, UMM_AL_QURA, NOW, null)
    ).toHaveLength(1));

  it("keeps a kept trip on a far fix with no time change", () => {
    const entry = mark(RIYADH);
    expect(conservativeKm(EAST_15KM, FIX_ACCURACY_KM, markPoint(entry), null)).toBeGreaterThan(
      MOVE_MIN_KM
    );
    expect(
      maxYearlyShiftMinutes(markPoint(entry), EAST_15KM, RIYADH_ZONE, UMM_AL_QURA, NOW)
    ).toBeLessThan(SHIFT_GATE_MINUTES);
    expect(keptAfterFix([entry], fresh(EAST_15KM), RIYADH_ZONE, UMM_AL_QURA, NOW, null)).toEqual([
      entry,
    ]);
  });

  it("has a shift under the gate from Manama to the Saudi point", () =>
    expect(
      maxYearlyShiftMinutes(
        markPoint(mark(MANAMA)),
        SAUDI_NEAR_MANAMA,
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW
      )
    ).toBeLessThan(SHIFT_GATE_MINUTES));

  it("ends a trip kept for a country change when a confirmed fix is home", () =>
    expect(
      keptAfterFix(
        [mark(MANAMA, NOW, BAHRAIN)],
        fresh(SAUDI_NEAR_MANAMA),
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW,
        COUNTRY_CODE.SAUDI_ARABIA
      )
    ).toEqual([]));

  it("keeps the trip when the mark has no country", () => {
    const entry = mark(MANAMA);
    expect(
      keptAfterFix(
        [entry],
        fresh(SAUDI_NEAR_MANAMA),
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW,
        COUNTRY_CODE.SAUDI_ARABIA
      )
    ).toEqual([entry]);
  });

  it("keeps the trip when the fix has no country", () => {
    const entry = mark(MANAMA, NOW, BAHRAIN);
    expect(
      keptAfterFix([entry], fresh(SAUDI_NEAR_MANAMA), RIYADH_ZONE, UMM_AL_QURA, NOW, null)
    ).toEqual([entry]);
  });

  it("keeps the trip while the country matches and the shift is under the gate", () => {
    const entry = mark(RIYADH, NOW, COUNTRY_CODE.SAUDI_ARABIA.toLowerCase());
    expect(
      keptAfterFix(
        [entry],
        fresh(EAST_15KM),
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW,
        COUNTRY_CODE.SAUDI_ARABIA
      )
    ).toEqual([entry]);
  });

  it.each([
    ["made now", 0, true],
    ["made 30 days ago", KEPT_MAX_AGE_MS, true],
    ["made just over 30 days ago", KEPT_MAX_AGE_MS + 1, false],
    ["dated a moment after now", -1, false],
  ])("reads a kept entry %s as live: %s", (_case, ageMs, live) =>
    expect(isLiveKept(mark(JEDDAH, NOW - ageMs), NOW)).toBe(live)
  );

  it("ends a kept trip after 30 days", () =>
    expect(
      keptAfterFix(
        [{ ...mark(JEDDAH), at: NOW - KEPT_MAX_AGE_MS - 1 }],
        fresh(JEDDAH_2),
        RIYADH_ZONE,
        UMM_AL_QURA,
        NOW,
        null
      )
    ).toEqual([]));

  it("replaces a mark the new one matches, newest first", () =>
    expect(withMark([mark(DUBAI, 1), mark(JEDDAH, 1)], mark(JEDDAH_2, 2), KEPT_MAX)).toEqual([
      mark(JEDDAH_2, 2),
      mark(DUBAI, 1),
    ]));

  it("drops the oldest mark past the cap", () => {
    const marks = Array.from({ length: KEPT_MAX + 1 }, (_, i) =>
      toPlaceMark({ latitude: 10 + i, longitude: 40 }, i)
    );
    const list = marks.reduce<PlaceMark[]>((acc, m) => withMark(acc, m, KEPT_MAX), []);
    expect(list).toHaveLength(KEPT_MAX);
    expect(list).not.toContainEqual(marks[0]);
  });
});
