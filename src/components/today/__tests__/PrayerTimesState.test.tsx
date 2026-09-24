import { screen, userEvent } from "@testing-library/react-native";

import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { TIMELINE_PART } from "@/components/ui/timeline";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import i18n from "@/localization/i18n";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

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
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const loadPrayerTimes = jest.fn(() => Promise.resolve());
const clearError = jest.fn();

const renderState = (state: {
  todayTimings: DayPrayerTimes | null;
  hasError: boolean;
  isLoading: boolean;
}) => {
  usePrayerTimesStore.setState({ ...state, loadPrayerTimes, clearError });
  return renderWithTheme(<PrayerTimesState />);
};

describe("PrayerTimesState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers a retry when the times failed to load", async () => {
    await renderState({ todayTimings: null, hasError: true, isLoading: false });

    await userEvent.press(screen.getByText(i18n.t("common.retry")));

    expect(clearError).toHaveBeenCalled();
    expect(loadPrayerTimes).toHaveBeenCalledWith(true);
  });

  it("holds the timeline's place while the times load", async () => {
    await renderState({ todayTimings: null, hasError: false, isLoading: true });

    expect(screen.getByTestId(TIMELINE_PART.SKELETON)).toBeTruthy();
    expect(screen.getByLabelText(i18n.t("common.loading"))).toBeTruthy();
  });

  it("shows nothing once the day's times are here", async () => {
    await renderState({ todayTimings: DAY, hasError: true, isLoading: true });

    expect(screen.toJSON()).toBeNull();
  });
});
