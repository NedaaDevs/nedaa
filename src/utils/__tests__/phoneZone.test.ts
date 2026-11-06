import { getCalendars } from "expo-localization";

import { phoneZoneReadings, readPhoneZone } from "@/utils/phoneZone";

jest.mock("expo-localization", () => ({ getCalendars: jest.fn() }));

const INTL_ZONE = "Asia/Dubai";
const CALENDAR_ZONE = "Asia/Riyadh";

const mockIntlZone = (timeZone: string) =>
  jest
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat
    );

afterEach(() => {
  jest.restoreAllMocks();
});

it("reads the zone from Intl and from expo-localization's calendar", () => {
  mockIntlZone(INTL_ZONE);
  jest.mocked(getCalendars).mockReturnValue([{ timeZone: CALENDAR_ZONE }] as never);

  expect(phoneZoneReadings()).toEqual({ intl: INTL_ZONE, calendar: CALENDAR_ZONE });
});

it("reads null from a source that throws or is empty", () => {
  jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
    throw new Error("no Intl");
  });
  jest.mocked(getCalendars).mockReturnValue([] as never);

  expect(phoneZoneReadings()).toEqual({ intl: null, calendar: null });
});

it("reads null from a calendar that throws", () => {
  mockIntlZone(INTL_ZONE);
  jest.mocked(getCalendars).mockImplementation(() => {
    throw new Error("no calendars");
  });

  expect(phoneZoneReadings()).toEqual({ intl: INTL_ZONE, calendar: null });
});

describe("readPhoneZone", () => {
  const mockCalendars = (calendars: { timeZone: string | null }[]) =>
    jest.mocked(getCalendars).mockReturnValue(calendars as never);

  it("reads the phone zone from the source that refreshes on a warm return", () => {
    mockIntlZone(INTL_ZONE);
    mockCalendars([{ timeZone: INTL_ZONE }]);

    expect(readPhoneZone()).toBe(INTL_ZONE);
  });

  it("takes the calendar's zone when the two sources differ", () => {
    mockIntlZone(INTL_ZONE);
    mockCalendars([{ timeZone: CALENDAR_ZONE }]);

    expect(readPhoneZone()).toBe(CALENDAR_ZONE);
  });

  it.each([
    ["no calendar", []],
    ["a calendar with no zone", [{ timeZone: null }]],
    ["a calendar with an empty zone", [{ timeZone: "" }]],
  ])("falls back to Intl's zone for %s", (_case, calendars) => {
    mockIntlZone(INTL_ZONE);
    mockCalendars(calendars);

    expect(readPhoneZone()).toBe(INTL_ZONE);
  });

  it("reads null when the source gives nothing", () => {
    jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("no Intl");
    });
    mockCalendars([]);

    expect(readPhoneZone()).toBeNull();
  });

  it("reads null when both sources are empty", () => {
    mockIntlZone("");
    mockCalendars([{ timeZone: "" }]);

    expect(readPhoneZone()).toBeNull();
  });
});
