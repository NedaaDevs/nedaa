import { clockFormat, formatPrayerTime } from "@/utils/date";
import { AppLocale } from "@/enums/app";

// Afternoon in Riyadh (UTC+3), so the 12- and 24-hour renderings differ and the
// timezone shift is observable.
const ISO = "2026-07-28T14:05:00.000Z";
const RIYADH = "Asia/Riyadh";

describe("clockFormat", () => {
  it("is the only place the clock format string is decided", () => {
    expect(clockFormat(true)).toBe("HH:mm");
    expect(clockFormat(false)).toBe("h:mm a");
  });
});

describe("formatPrayerTime", () => {
  it("renders 24-hour time zero-padded, with no meridiem", () => {
    expect(formatPrayerTime(ISO, RIYADH, { locale: AppLocale.EN, use24HourTime: true })).toBe(
      "17:05"
    );
  });

  it("renders 12-hour time with a meridiem", () => {
    expect(formatPrayerTime(ISO, RIYADH, { locale: AppLocale.EN, use24HourTime: false })).toMatch(
      /^5:05\s?PM$/i
    );
  });

  it("resolves the time in the given timezone, not the device's", () => {
    expect(formatPrayerTime(ISO, "UTC", { locale: AppLocale.EN, use24HourTime: true })).toBe(
      "14:05"
    );
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(
      formatPrayerTime(new Date(ISO), RIYADH, { locale: AppLocale.EN, use24HourTime: true })
    ).toBe("17:05");
  });

  it("pads the hour past midnight so times stay column-aligned", () => {
    const preDawn = "2026-07-28T01:11:00.000Z"; // 04:11 in Riyadh
    expect(formatPrayerTime(preDawn, RIYADH, { locale: AppLocale.EN, use24HourTime: true })).toBe(
      "04:11"
    );
    expect(
      formatPrayerTime(preDawn, RIYADH, { locale: AppLocale.EN, use24HourTime: false })
    ).toMatch(/^4:11\s?AM$/i);
  });

  it("leaves digits Latin — localizing numerals is the caller's job", () => {
    expect(formatPrayerTime(ISO, RIYADH, { locale: AppLocale.AR, use24HourTime: true })).toBe(
      "17:05"
    );
  });
});
