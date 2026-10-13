import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { parseAladhanApplied } from "@/utils/providers/aladhan";

const NO_TUNING = PRAYER_TIME_PROVIDERS.ALADHAN.tuning;
const UMM_AL_QURA = PRAYER_TIME_PROVIDERS.ALADHAN.methods.find((m) => m.nameKey === "makkah")!.id;

describe("parseAladhanApplied", () => {
  it("reads the settings the provider used", () => {
    expect(
      parseAladhanApplied({
        method: UMM_AL_QURA,
        madhab: ASR_SCHOOL.SHAFI,
        midnightMode: MIDNIGHT_MODE.STANDARD,
        tune: { fajr: 2, isha: -3 },
      })
    ).toEqual({
      method: UMM_AL_QURA,
      madhab: ASR_SCHOOL.SHAFI,
      midnightMode: MIDNIGHT_MODE.STANDARD,
      tune: { ...NO_TUNING, fajr: 2, isha: -3 },
    });
  });

  it("drops a value the app does not know", () => {
    expect(
      parseAladhanApplied({ method: 999, madhab: 7, midnightMode: "x", tune: { fajr: "2" } })
    ).toEqual({ tune: NO_TUNING });
  });

  it("counts a timing the provider leaves out as unmoved", () => {
    expect(parseAladhanApplied({ tune: { fajr: 1, lunch: 5 } })).toEqual({
      tune: { ...NO_TUNING, fajr: 1 },
    });
  });

  it.each([undefined, null, "aladhan", 4, []])("returns null for %p", (raw) => {
    expect(parseAladhanApplied(raw)).toBeNull();
  });
});
