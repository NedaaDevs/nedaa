import { createRef } from "react";
import { AccessibilityInfo, View } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { PrayerDetailSheet } from "@/components/prayer-detail/PrayerDetailSheet";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { BOTTOM_SHEET_PART } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const HEADER = "header";
// The open sheet hides its siblings from a reader, so queries look past that.
const hidden = { includeHiddenElements: true };

/** A stored day in UTC; 25 September 2026 is a Friday. */
const day = (date: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

const opener = createRef<View>();

const renderOn = (date: string, prayerId?: PrayerId, onClose = jest.fn()) => {
  jest.useFakeTimers({ now: new Date(`${date}T10:00:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  return renderWithTheme(
    <>
      <View ref={opener} accessible accessibilityRole="button" />
      <PrayerDetailSheet prayerId={prayerId} onClose={onClose} finalFocusRef={opener} />
    </>
  );
};

const focusEvent = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");

describe("PrayerDetailSheet", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    focusEvent.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("stays closed with no prayer chosen", async () => {
    await renderOn("2026-09-23");

    expect(screen.queryByTestId(BOTTOM_SHEET_PART.CONTENT, hidden)).toBeNull();
  });

  it("opens on the chosen prayer, headed by its name", async () => {
    await renderOn("2026-09-23", PRAYER_ID.ASR);

    expect(screen.getByRole(HEADER, { name: i18n.t("prayerTimes.asr") })).toBeOnTheScreen();
  });

  it("names Dhuhr as Jumuah on a Friday", async () => {
    await renderOn("2026-09-25", PRAYER_ID.DHUHR);

    expect(screen.getByRole(HEADER, { name: i18n.t("prayerTimes.jumuah") })).toBeOnTheScreen();
  });

  it("offers the reliable alarm for Fajr and not for Asr", async () => {
    const alarms = { name: i18n.t("prayerDetail.sections.alarms"), ...hidden };
    await renderOn("2026-09-23", PRAYER_ID.FAJR);
    expect(screen.getByRole(HEADER, alarms)).toBeOnTheScreen();

    await renderOn("2026-09-23", PRAYER_ID.ASR);
    expect(screen.queryByRole(HEADER, alarms)).toBeNull();
  });

  it("reports a close from the sheet itself", async () => {
    const onClose = jest.fn();
    await renderOn("2026-09-23", PRAYER_ID.ASR, onClose);

    await act(() => fireEvent.press(screen.getByTestId(BOTTOM_SHEET_PART.BACKDROP)));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from its own close button", async () => {
    const onClose = jest.fn();
    await renderOn("2026-09-23", PRAYER_ID.ASR, onClose);

    // The backdrop is named Close too; this is the sheet's own button.
    const [button] = screen
      .getAllByRole("button", { name: i18n.t("common.close") })
      .filter((each) => each.props.testID !== BOTTOM_SHEET_PART.BACKDROP);
    await act(() => fireEvent.press(button));

    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the prayer named when its times cannot be shown", async () => {
    await renderOn("2026-09-23", PRAYER_ID.ASR);
    await act(() => usePrayerTimesStore.setState({ todayTimings: null, isLoading: false }));

    expect(screen.getByRole(HEADER, { name: i18n.t("prayerTimes.asr") })).toBeOnTheScreen();
    expect(screen.getByText(i18n.t("prayerDetail.states.unavailable.title"))).toBeOnTheScreen();
  });

  it("hands reader focus back to the opener once closed", async () => {
    await renderOn("2026-09-23", PRAYER_ID.ASR);

    await screen.rerender(
      <>
        <View ref={opener} accessible accessibilityRole="button" />
        <PrayerDetailSheet onClose={jest.fn()} finalFocusRef={opener} />
      </>
    );

    expect(focusEvent.mock.lastCall?.[0]).toBe(opener.current);
  });
});
