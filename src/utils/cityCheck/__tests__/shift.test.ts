import { SHIFT_GATE_MINUTES, SHIFT_TIMING, type ShiftTiming } from "@/constants/CityCheck";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import type { ShiftCalc } from "@/types/cityCheck";
import type { Coords } from "@/types/location";
import { maxYearlyShiftMinutes, yearlyShiftByTiming } from "@/utils/cityCheck/shift";
import rows from "@/utils/cityCheck/__tests__/fixtures/aladhanRows2026.json";

type PlaceKey = keyof typeof rows.places;

const MINUTE_MS = 60_000;
// The spec's agreement bound between the estimate and server rows.
const SERVER_AGREE_MINUTES = 1;
const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const TIMINGS: ShiftTiming[] = Object.values(SHIFT_TIMING);

const place = (key: PlaceKey) => rows.places[key];
const pt = (key: PlaceKey): Coords => ({
  latitude: place(key).latitude,
  longitude: place(key).longitude,
});
const zone = (key: PlaceKey): string => place(key).zone;

const calcOf = (key: PlaceKey): ShiftCalc => {
  const method = ALADHAN.methods.find(({ id }) => id === place(key).method);
  const school = ALADHAN.schools.find(({ id }) => id === place(key).school);
  if (!method || !school) throw new Error(`fixture place ${key} has no known calc`);
  return { method: method.id, school: school.id };
};

// Midnight on the fixture's first day, in the place's own zone.
const startOf = (key: PlaceKey): number =>
  Date.UTC(Number(rows.fetchedAt.slice(0, 4)), 0, 1) - place(key).utcOffsetMinutes * MINUTE_MS;

// The largest change of one timing over the rows, in UTC minutes.
const serverShift = (from: PlaceKey, to: PlaceKey, timing: ShiftTiming): number => {
  const column = TIMINGS.indexOf(timing);
  const fromOffset = place(from).utcOffsetMinutes;
  const toOffset = place(to).utcOffsetMinutes;
  return place(from).days.reduce((largest, fromDay, day) => {
    const toDay = place(to).days[day];
    const shift = Math.abs(toDay[column] - toOffset - (fromDay[column] - fromOffset));
    return Math.max(largest, shift);
  }, 0);
};

const RIYADH_ZONE = zone("riyadh");
const UMM_AL_QURA = calcOf("riyadh");
const START = startOf("riyadh");

// A border pair whose zones are an hour apart, about 17 km apart on the map.
const BADAJOZ: Coords = { latitude: 38.8794, longitude: -6.9707 };
const ELVAS: Coords = { latitude: 38.881, longitude: -7.163 };
const MADRID_ZONE = "Europe/Madrid";
// 00:30 on 2 March in Madrid, still 23:30 on 1 March in Lisbon.
const SPLIT_DATE_AT = Date.UTC(2026, 2, 1, 23, 30);

const PAIRS = [
  ["makkah", "jeddah"],
  ["makkahHanafi", "jeddahHanafi"],
  ["riyadh", "diriyah"],
  ["dammam", "khobar"],
  ["khobar", "manama"],
  ["riyadh", "dubai"],
  ["london", "croydon"],
  ["londonMsc", "croydonMsc"],
] as const;

describe("yearly prayer-time shift", () => {
  it.each(PAIRS)(
    "agrees with server rows to 1 minute for each timing, Asr included: %s → %s",
    (a, b) => {
      const estimate = yearlyShiftByTiming(pt(a), pt(b), zone(a), calcOf(a), startOf(a));
      const misses = TIMINGS.filter(
        (timing) => Math.abs(estimate[timing] - serverShift(a, b, timing)) > SERVER_AGREE_MINUTES
      );
      expect(misses).toEqual([]);
    }
  );

  it("puts Makkah → Jeddah at or over the gate", () => {
    const shift = maxYearlyShiftMinutes(
      pt("makkah"),
      pt("jeddah"),
      RIYADH_ZONE,
      UMM_AL_QURA,
      START
    );
    expect(shift).toBeGreaterThanOrEqual(SHIFT_GATE_MINUTES);
  });

  it("puts Riyadh → Diriyah under the gate", () => {
    const shift = maxYearlyShiftMinutes(
      pt("riyadh"),
      pt("diriyah"),
      RIYADH_ZONE,
      UMM_AL_QURA,
      START
    );
    expect(shift).toBeLessThan(SHIFT_GATE_MINUTES);
  });

  it("compares the same calendar day when the two zones are on different dates", () => {
    const shift = maxYearlyShiftMinutes(BADAJOZ, ELVAS, MADRID_ZONE, UMM_AL_QURA, SPLIT_DATE_AT);
    expect(shift).toBeLessThan(SHIFT_GATE_MINUTES);
  });

  it("measures no shift for the same point", () => {
    const p = pt("riyadh");
    expect(maxYearlyShiftMinutes(p, p, RIYADH_ZONE, UMM_AL_QURA, START)).toBe(0);
  });
});
