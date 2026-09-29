import { screen, userEvent } from "@testing-library/react-native";

import {
  SheetErrorState,
  SheetLoadingState,
  SheetUnavailableState,
} from "@/components/prayer-detail/SheetStates";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import i18n from "@/localization/i18n";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

// 25 September 2026 is a Friday.
const FRIDAY: DayPrayerTimes = {
  date: 20260925,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-25T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-25T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-25T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-25T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-25T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-25T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const NOON = new Date("2026-09-25T13:00:00.000Z");

const renderIn = (ui: React.ReactElement, today: DayPrayerTimes | null = null) => {
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: today,
    tomorrowTimings: null,
  });
  return renderWithTheme(<SimulatedClockContext value={NOON}>{ui}</SimulatedClockContext>);
};

const retryButton = () => screen.getByRole("button", { name: i18n.t("common.retry") });

describe("SheetStates", () => {
  it("keeps the prayer named while its settings load, and announces the wait", async () => {
    await renderIn(<SheetLoadingState prayerId={PRAYER_ID.ASR} />, FRIDAY);

    expect(screen.getByRole("header", { name: i18n.t("prayerTimes.asr") })).toBeTruthy();
    const message = screen.getByLabelText(
      `${i18n.t("prayerDetail.states.loading.title")}. ${i18n.t("prayerDetail.states.loading.body", { prayer: i18n.t("prayerTimes.asr") })}`
    );
    expect(message.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names Friday's Dhuhr as Jumu'ah when the day is known", async () => {
    await renderIn(<SheetLoadingState prayerId={PRAYER_ID.DHUHR} />, FRIDAY);

    expect(screen.getByRole("header", { name: i18n.t("prayerTimes.jumuah") })).toBeTruthy();
  });

  it("names Dhuhr plainly when no day is known", async () => {
    await renderIn(<SheetUnavailableState prayerId={PRAYER_ID.DHUHR} onRetry={jest.fn()} />);

    expect(screen.getByRole("header", { name: i18n.t("prayerTimes.dhuhr") })).toBeTruthy();
  });

  it.each([
    ["unavailable", SheetUnavailableState],
    ["error", SheetErrorState],
  ])("says the %s state for the prayer and retries on request", async (state, View) => {
    const onRetry = jest.fn();
    await renderIn(<View prayerId={PRAYER_ID.FAJR} onRetry={onRetry} />);

    const prayer = i18n.t("prayerTimes.fajr");
    expect(screen.getByRole("header", { name: prayer })).toBeTruthy();
    expect(
      screen.getByLabelText(
        `${i18n.t(`prayerDetail.states.${state}.title`)}. ${i18n.t(`prayerDetail.states.${state}.body`, { prayer })}`
      )
    ).toBeTruthy();

    await userEvent.press(retryButton());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderIn(<SheetErrorState prayerId={PRAYER_ID.ISHA} onRetry={jest.fn()} />);

    expect(retryButton().props.accessibilityHint).toBe(i18n.t("a11y.prayerDetail.states.retry"));
    expect(controlProblems()).toEqual([]);
  });
});
