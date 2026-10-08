import {
  dateToInt,
  getThreeDayDateRange,
  getTimezoneMonth,
  getTimezoneYear,
  timeZonedNow,
} from "@/utils/date";

let mockScreenshotMode = false;
jest.mock("@/screenshot-mode/flag", () => ({
  get IS_SCREENSHOT_MODE() {
    return mockScreenshotMode;
  },
}));

const TIMEZONE = "Asia/Riyadh";

describe("the day the prayer data is read for", () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") }));
  afterEach(() => {
    jest.useRealTimers();
    mockScreenshotMode = false;
  });

  it("follows the device clock", () => {
    expect(getTimezoneYear(TIMEZONE)).toBe(2026);
    expect(getTimezoneMonth(TIMEZONE)).toBe(9);
    expect(getThreeDayDateRange(TIMEZONE).today).toBe(20260923);
  });

  // The times on screen must belong to the day the screenshot clock shows.
  it("follows the screenshot moment in a screenshot build", () => {
    mockScreenshotMode = true;

    expect(dateToInt(timeZonedNow(TIMEZONE))).toBe(20260513);
    expect(getTimezoneYear(TIMEZONE)).toBe(2026);
    expect(getTimezoneMonth(TIMEZONE)).toBe(5);
    expect(getThreeDayDateRange(TIMEZONE)).toEqual({
      yesterday: 20260512,
      today: 20260513,
      tomorrow: 20260514,
    });
  });
});
