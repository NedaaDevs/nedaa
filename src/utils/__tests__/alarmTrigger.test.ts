import { pickNextTrigger } from "@/utils/alarmTrigger";
import type { TimingConfig } from "@/types/alarm";

const at = (iso: string) => new Date(iso).getTime();

const before30: TimingConfig = { mode: "beforePrayerTime", minutesBefore: 30 };
const atPrayer: TimingConfig = { mode: "atPrayerTime", minutesBefore: 30 };

describe("pickNextTrigger", () => {
  const todayFajr = new Date("2026-07-23T05:00:00Z");
  const tomorrowFajr = new Date("2026-07-24T05:02:00Z");

  it("rolls to tomorrow when today's before-prayer trigger already passed", () => {
    // Alarm fired at 04:30, challenge completed 04:31; today's Fajr is still future
    const result = pickNextTrigger([todayFajr, tomorrowFajr], before30, at("2026-07-23T04:31:00Z"));

    expect(result?.triggerDate.toISOString()).toBe("2026-07-24T04:32:00.000Z");
    expect(result?.prayerDate).toBe(tomorrowFajr);
  });

  it("keeps today's prayer while its trigger is still future", () => {
    const result = pickNextTrigger([todayFajr, tomorrowFajr], before30, at("2026-07-23T04:00:00Z"));

    expect(result?.triggerDate.toISOString()).toBe("2026-07-23T04:30:00.000Z");
    expect(result?.prayerDate).toBe(todayFajr);
  });

  it("uses the prayer time itself in atPrayerTime mode", () => {
    const result = pickNextTrigger([todayFajr, tomorrowFajr], atPrayer, at("2026-07-23T04:31:00Z"));

    expect(result?.triggerDate.toISOString()).toBe("2026-07-23T05:00:00.000Z");
  });

  it("treats a missing timing config as atPrayerTime", () => {
    const result = pickNextTrigger([todayFajr, tomorrowFajr], null, at("2026-07-23T04:31:00Z"));

    expect(result?.triggerDate.toISOString()).toBe("2026-07-23T05:00:00.000Z");
  });

  it("skips null candidates from missing prayer data", () => {
    const result = pickNextTrigger([null, tomorrowFajr], before30, at("2026-07-23T04:31:00Z"));

    expect(result?.prayerDate).toBe(tomorrowFajr);
  });

  it("returns null when no candidate produces a future trigger", () => {
    const result = pickNextTrigger([todayFajr], before30, at("2026-07-23T06:00:00Z"));

    expect(result).toBeNull();
  });
});
