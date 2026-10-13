import { PRAYER_ID } from "@/constants/Prayer";

import {
  TUNING_LIMIT,
  TUNED_PRAYERS,
  clampTuning,
  isTuned,
  signedOffset,
  spokenTuning,
  summarisePrayerTuning,
  summariseTuning,
} from "@/components/calculation/tuning";

import { AppLocale } from "@/enums/app";
import type { AladhanTuning } from "@/types/providers/aladhan";

jest.mock("@/utils/number", () => ({ formatNumberToLocale: (value: string) => value }));

// U+2066 LRI / U+2069 PDI wrap each offset.
const ltr = (text: string) => `\u2066${text}\u2069`;

// Mirrors i18n closely enough to assert ordering and signs.
const t = (key: string) => key.split(".").pop() ?? key;

const tuning = (overrides: Partial<AladhanTuning> = {}) =>
  ({
    [PRAYER_ID.FAJR]: 0,
    sunrise: 0,
    [PRAYER_ID.DHUHR]: 0,
    [PRAYER_ID.ASR]: 0,
    [PRAYER_ID.MAGHRIB]: 0,
    sunset: 0,
    [PRAYER_ID.ISHA]: 0,
    midnight: 0,
    ...overrides,
  }) as AladhanTuning;

describe("clampTuning", () => {
  test("keeps a value inside the supported range", () => {
    expect(clampTuning(12)).toBe(12);
    expect(clampTuning(-12)).toBe(-12);
  });

  test("clamps beyond the limit in both directions", () => {
    expect(clampTuning(TUNING_LIMIT + 5)).toBe(TUNING_LIMIT);
    expect(clampTuning(-TUNING_LIMIT - 5)).toBe(-TUNING_LIMIT);
  });
});

describe("summariseTuning", () => {
  test("reports nothing when no prayer is adjusted", () => {
    expect(summariseTuning(tuning(), t)).toBeNull();
  });

  test("names the adjusted prayer and its offset", () => {
    expect(summariseTuning(tuning({ [PRAYER_ID.FAJR]: 2 }), t)).toBe(`fajr ${ltr("+2")}`);
  });

  test("signs a negative offset", () => {
    expect(summariseTuning(tuning({ [PRAYER_ID.ISHA]: -3 }), t)).toBe(`isha ${ltr("-3")}`);
  });

  test("lists several adjustments in prayer order, not input order", () => {
    expect(summariseTuning(tuning({ [PRAYER_ID.ISHA]: -3, [PRAYER_ID.FAJR]: 2 }), t)).toBe(
      `fajr ${ltr("+2")} · isha ${ltr("-3")}`
    );
  });

  test("omits prayers left at zero", () => {
    expect(summariseTuning(tuning({ [PRAYER_ID.FAJR]: 2, [PRAYER_ID.ASR]: 0 }), t)).toBe(
      `fajr ${ltr("+2")}`
    );
  });

  test("isolates the offset so bidi cannot detach the sign", () => {
    const summary = summariseTuning(tuning({ [PRAYER_ID.FAJR]: 2 }), t) as string;

    expect(summary).toContain("\u2066+2\u2069");
  });
});

describe("summarisePrayerTuning", () => {
  // Echoes the key and count, so each case shows which copy it chose.
  const tCount = (key: string, options?: { count: number }) =>
    options ? `${key}:${options.count}` : key;

  test("reports no adjustment at zero", () => {
    expect(summarisePrayerTuning(tuning({ [PRAYER_ID.ISHA]: 4 }), PRAYER_ID.FAJR, tCount)).toBe(
      "prayerDetail.adjustment.none"
    );
  });

  test("reports no adjustment when no tuning is stored", () => {
    expect(summarisePrayerTuning(undefined, PRAYER_ID.FAJR, tCount)).toBe(
      "prayerDetail.adjustment.none"
    );
  });

  test("counts a positive offset as minutes later", () => {
    expect(summarisePrayerTuning(tuning({ [PRAYER_ID.FAJR]: 5 }), PRAYER_ID.FAJR, tCount)).toBe(
      "prayerDetail.adjustment.later:5"
    );
  });

  test("counts a negative offset as minutes earlier, unsigned", () => {
    expect(summarisePrayerTuning(tuning({ [PRAYER_ID.FAJR]: -3 }), PRAYER_ID.FAJR, tCount)).toBe(
      "prayerDetail.adjustment.earlier:3"
    );
  });
});

describe("TUNED_PRAYERS", () => {
  test("covers every tunable timing in daily order", () => {
    expect(TUNED_PRAYERS).toEqual([
      PRAYER_ID.FAJR,
      "sunrise",
      PRAYER_ID.DHUHR,
      PRAYER_ID.ASR,
      PRAYER_ID.MAGHRIB,
      "sunset",
      PRAYER_ID.ISHA,
      "midnight",
    ]);
  });
});

describe("isTuned", () => {
  test("is false with no tuning or only zeros", () => {
    expect(isTuned(undefined)).toBe(false);
    expect(isTuned(tuning())).toBe(false);
  });

  test("is true once any timing moves", () => {
    expect(isTuned(tuning({ sunset: -1 }))).toBe(true);
  });
});

describe("signedOffset", () => {
  test("keeps the sign before the figure in the locale's digits", () => {
    expect(signedOffset(2, AppLocale.AR, false)).toBe(ltr("+٢"));
    expect(signedOffset(-3, AppLocale.EN, false)).toBe(ltr("-3"));
  });
});

describe("spokenTuning", () => {
  // Joins as the a11y.join copy does, and counts with the minute phrase.
  const speak = (key: string, options?: Record<string, unknown>) =>
    key === "a11y.join"
      ? `${options?.first}, ${options?.second}`
      : options?.count !== undefined
        ? `${key.split(".").pop()} ${options.count}`
        : (key.split(".").pop() ?? key);

  test("says each moved timing with its minutes, in daily order", () => {
    expect(spokenTuning(tuning({ [PRAYER_ID.ISHA]: -3, [PRAYER_ID.FAJR]: 2 }), speak)).toBe(
      "fajr, later 2, isha, earlier 3"
    );
  });

  test("is null when nothing moves", () => {
    expect(spokenTuning(undefined, speak)).toBeNull();
  });
});

describe("summariseTuning with more than two moved", () => {
  // Counts with the key so the tail can be told from the names.
  const tCount = (key: string, options?: { count?: number }) =>
    options?.count === undefined ? (key.split(".").pop() ?? key) : `${key}:${options.count}`;

  test("names the first two in the day's order and counts the rest", () => {
    expect(
      summariseTuning(
        tuning({ [PRAYER_ID.ISHA]: -1, [PRAYER_ID.FAJR]: 2, [PRAYER_ID.ASR]: 3, sunrise: 1 }),
        tCount
      )
    ).toBe(`fajr ${ltr("+2")} · sunrise ${ltr("+1")} · settings.calculation.tuning.more:2`);
  });

  test("names two without a count", () => {
    expect(summariseTuning(tuning({ [PRAYER_ID.FAJR]: 2, [PRAYER_ID.ISHA]: -3 }), tCount)).toBe(
      `fajr ${ltr("+2")} · isha ${ltr("-3")}`
    );
  });
});
