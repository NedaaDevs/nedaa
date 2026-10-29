import { getCalendars } from "expo-localization";

import { phoneZoneReadings } from "@/utils/phoneZone";

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
