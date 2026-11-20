import { OTHER_TIMING } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { RIYADH_DAY, RIYADH_ZONE, riyadhAt } from "@/test-helpers/prayerDay";
import { formatPrayerTime } from "@/utils/date";
import type { StoredDays } from "@/utils/phase";
import { spokenClockTime } from "@/utils/spokenClockTime";

const RIYADH = "Asia/Riyadh";
const NEW_YORK = "America/New_York";
const UTC = "UTC";

const MORNING = "2026-09-23T05:03:00.000Z";
const NOON = "2026-09-23T12:10:00.000Z";
const EVENING = "2026-09-23T18:10:00.000Z";

type Case = [AppLocale, boolean, string, string];

// Arabic speaks the hour in words, so speech cannot read the digits as a clock.
const CASES: Case[] = [
  [AppLocale.AR, false, MORNING, "الخامسة و٣ دقائق صباحًا"],
  [AppLocale.AR, false, NOON, "الثانية عشرة و١٠ دقائق ظهرًا"],
  [AppLocale.AR, false, EVENING, "السادسة و١٠ دقائق مساءً"],
  [AppLocale.AR, true, MORNING, "الخامسة و٣ دقائق صباحًا"],
  [AppLocale.AR, true, NOON, "الثانية عشرة و١٠ دقائق ظهرًا"],
  [AppLocale.AR, true, EVENING, "السادسة و١٠ دقائق مساءً"],
  [AppLocale.EN, false, MORNING, "5:03 AM"],
  [AppLocale.EN, false, NOON, "12:10 PM"],
  [AppLocale.EN, false, EVENING, "6:10 PM"],
  [AppLocale.EN, true, MORNING, "05:03"],
  [AppLocale.EN, true, NOON, "12:10"],
  [AppLocale.EN, true, EVENING, "18:10"],
  [AppLocale.MS, false, MORNING, "5:03 AM"],
  [AppLocale.MS, false, NOON, "12:10 PM"],
  [AppLocale.MS, false, EVENING, "6:10 PM"],
  [AppLocale.MS, true, EVENING, "18:10"],
  [AppLocale.UR, false, MORNING, "5:03 صبح"],
  [AppLocale.UR, false, NOON, "12:10 شام"],
  [AppLocale.UR, false, EVENING, "6:10 شام"],
  [AppLocale.UR, true, EVENING, "18:10"],
];

const speak = (
  date: string | Date,
  timezone: string,
  locale: AppLocale,
  use24HourTime: boolean,
  western = false,
  days?: StoredDays
) => {
  // Translated copy reads the same preference, as it does in the app.
  usePreferencesStore.setState({ useWesternNumerals: western });
  return spokenClockTime(
    date,
    timezone,
    { locale, use24HourTime, western, days },
    i18n.getFixedT(locale)
  );
};

// Riyadh's stored day, whose sun sets at 17:40.
const RIYADH_DAYS: StoredDays = { today: RIYADH_DAY };

/** A Riyadh clock reading spoken in Arabic, against the stored days. */
const speakInRiyadh = (time: string, days: StoredDays) =>
  speak(riyadhAt(time), RIYADH_ZONE, AppLocale.AR, false, false, days);

describe("spokenClockTime", () => {
  it.each(CASES)("speaks %s (24-hour %s) at %s as %s", (locale, use24HourTime, iso, expected) => {
    expect(speak(iso, UTC, locale, use24HourTime)).toBe(expected);
  });

  // Hours, minute counts and the time of day all read as people say them.
  it.each([
    ["2026-09-23T18:00:00.000Z", "السادسة مساءً"],
    ["2026-09-23T18:01:00.000Z", "السادسة ودقيقة واحدة مساءً"],
    ["2026-09-23T18:02:00.000Z", "السادسة ودقيقتان مساءً"],
    ["2026-09-23T19:11:00.000Z", "السابعة و١١ دقيقة مساءً"],
    ["2026-09-23T15:30:00.000Z", "الثالثة و٣٠ دقيقة عصرًا"],
    ["2026-09-23T02:00:00.000Z", "الثانية ليلًا"],
    ["2026-09-23T00:30:00.000Z", "الثانية عشرة و٣٠ دقيقة ليلًا"],
  ])("speaks %s in Arabic as %s", (iso, expected) => {
    expect(speak(iso, UTC, AppLocale.AR, false)).toBe(expected);
  });

  // Asr ends at sunset, so a winter Maghrib before 18:00 is already evening.
  it.each([
    ["17:40", "الخامسة و٤٠ دقيقة مساءً"],
    ["17:50", "الخامسة و٥٠ دقيقة مساءً"],
    ["17:30", "الخامسة و٣٠ دقيقة عصرًا"],
  ])("speaks %s on a day whose sun sets at 17:40 as %s", (time, expected) => {
    expect(speakInRiyadh(time, RIYADH_DAYS)).toBe(expected);
  });

  // The device can sit in another zone than the place whose day it holds.
  it("reads the sunset only for a time in the day's own zone", () => {
    const spoken = speak(riyadhAt("17:40"), UTC, AppLocale.AR, false, false, RIYADH_DAYS);
    expect(spoken).toBe("الثانية و٤٠ دقيقة ظهرًا");
  });

  // Near the polar night the sun can set before noon.
  it("keeps a time before noon in the morning after an early sunset", () => {
    const early = {
      ...RIYADH_DAY,
      otherTimings: { ...RIYADH_DAY.otherTimings, [OTHER_TIMING.SUNSET]: riyadhAt("11:30") },
    };
    expect(speakInRiyadh("11:45", { today: early })).toBe("الحادية عشرة و٤٥ دقيقة صباحًا");
  });

  it("keeps Western digits when the reader prefers them", () => {
    expect(speak(EVENING, UTC, AppLocale.AR, false, true)).toBe("السادسة و10 دقائق مساءً");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(speak(new Date(EVENING), UTC, AppLocale.AR, false)).toBe("السادسة و١٠ دقائق مساءً");
  });

  // Morning in UTC is past noon in Riyadh, and the reverse in New York.
  it("decides the period in the prayer's time zone, not the device's", () => {
    expect(speak("2026-09-23T09:10:00.000Z", RIYADH, AppLocale.AR, false)).toBe(
      "الثانية عشرة و١٠ دقائق ظهرًا"
    );
    expect(speak("2026-09-23T13:10:00.000Z", NEW_YORK, AppLocale.AR, false)).toBe(
      "التاسعة و١٠ دقائق صباحًا"
    );
  });

  // The spoken time carries the drawn clock, only the period word differs.
  it("speaks the same hour and minute the screen draws", () => {
    const drawn = formatPrayerTime(EVENING, RIYADH, {
      locale: AppLocale.EN,
      use24HourTime: false,
    });
    expect(drawn.startsWith(speak(EVENING, RIYADH, AppLocale.EN, false).split(" ")[0])).toBe(true);
  });
});
