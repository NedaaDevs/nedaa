import { screen, userEvent } from "@testing-library/react-native";

import { OTHER_TIME_LABEL_KEY, OtherTimes } from "@/components/today/OtherTimes";
import { OTHER_TIMING, OTHER_TIMING_NAMES, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { formatPrayerTime } from "@/utils/date";
import { controlProblems } from "@/test-helpers/controls";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const OTHER = {
  [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  [OTHER_TIMING.SUNSET]: "2026-09-23T18:05:00.000Z",
  [OTHER_TIMING.IMSAK]: "2026-09-23T04:20:00.000Z",
  [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:57:00.000Z",
  [OTHER_TIMING.FIRST_THIRD]: "2026-09-23T22:00:00.000Z",
  [OTHER_TIMING.LAST_THIRD]: "2026-09-24T01:55:00.000Z",
};
const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: OTHER as DayPrayerTimes["otherTimings"],
};

describe("OtherTimes", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
    });
  });
  afterEach(() => jest.useRealTimers());

  it("opens to the six other times of the day, each with its time", async () => {
    await renderWithTheme(<OtherTimes />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: i18n.t("otherTimings.title") }));

    for (const name of OTHER_TIMING_NAMES) {
      const time = formatPrayerTime(OTHER[name], "UTC", {
        locale: AppLocale.EN,
        use24HourTime: false,
      });
      expect(screen.getByLabelText(`${i18n.t(OTHER_TIME_LABEL_KEY[name])}, ${time}`)).toBeTruthy();
    }
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderWithTheme(<OtherTimes />);

    expect(controlProblems()).toEqual([]);
  });
});
