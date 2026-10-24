import { parseISO } from "date-fns";

import { OTHER_TIMING, PRAYER_ID, PRAYER_IDS } from "@/constants/Prayer";
import { prayerDayAt, storedDayList } from "@/utils/phase";
import { rhythmLine } from "@/utils/rhythm";
import { sampleDays } from "@/utils/sampleDays";

const NOON = new Date(2026, 9, 24, 12, 30);

describe("sampleDays", () => {
  it("holds yesterday, today and tomorrow, a day apart", () => {
    const days = storedDayList(sampleDays(NOON, "UTC"));

    expect(days.map((day) => day.date)).toEqual([20261023, 20261024, 20261025]);
  });

  it("puts the five prayers in the day's order", () => {
    const { today } = sampleDays(NOON, "UTC");
    const times = PRAYER_IDS.map((id) => parseISO(today?.timings[id] ?? "").getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  // Today's own rules read the sample as they read stored times.
  it("is the prayer day at noon, with sunrise after Fajr", () => {
    const days = sampleDays(NOON, "UTC");
    const day = prayerDayAt(NOON, days);

    expect(day).toBe(days.today);
    expect(day && rhythmLine(day, NOON, days.tomorrow).night).toBeNull();
    expect(parseISO(day?.otherTimings[OTHER_TIMING.SUNRISE] ?? "").getTime()).toBeGreaterThan(
      parseISO(day?.timings[PRAYER_ID.FAJR] ?? "").getTime()
    );
  });

  // The last third falls in the night after the day, as a provider dates it.
  it("places the last third after the next midnight", () => {
    const { today } = sampleDays(NOON, "UTC");

    expect(parseISO(today?.otherTimings[OTHER_TIMING.LAST_THIRD] ?? "").getDate()).toBe(25);
  });
});
