import { PRAYER_ID } from "@/constants/Prayer";

import {
  TUNING_LIMIT,
  TUNED_PRAYERS,
  clampTuning,
  summariseTuning,
} from "@/components/AladhanSettings/tuning";

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
