// First: expo-router's testing library re-mocks Reanimated as it loads,
// and the screen must bind to the mock below, not to its empty one.
import TodayScreen from "@/app/(tabs)/index";
import { Component } from "react";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { AccessibilityInfo, AppState, Text } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { ThemeProvider } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

// Renders the whole Today screen under a router; a full parallel run passes 5 s.
jest.setTimeout(20_000);
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));

const scheduler = scheduleAllNotifications as jest.Mock;

// The preset's AppState mock reports no state, which reads as not in front.
const CURRENT_STATE = Object.getOwnPropertyDescriptor(AppState, "currentState");

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
    [OTHER_TIMING.SUNSET]: "2026-09-23T18:05:00.000Z",
    [OTHER_TIMING.IMSAK]: "2026-09-23T04:20:00.000Z",
    [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:57:00.000Z",
    [OTHER_TIMING.FIRST_THIRD]: "2026-09-23T22:00:00.000Z",
    [OTHER_TIMING.LAST_THIRD]: "2026-09-24T01:55:00.000Z",
  },
};

const PROVIDER_SCREEN = "provider-settings";

const renderToday = () =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => <TodayScreen />,
      [BACK_DESTINATION.SETTINGS_PROVIDER.route]: () => <Text>{PROVIDER_SCREEN}</Text>,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

// Lets a flush reach the scheduler past the batch and the qada lookups.
const settle = () => act(() => jest.runOnlyPendingTimersAsync());

// The open sheet hides the app from a reader; queries look past that.
const hidden = { hidden: true };

/** Opens Maghrib's sheet and makes two alert changes inside it. */
const openAndEdit = async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderToday();
  await user.press(
    screen.getByRole("button", { name: new RegExp(`^${i18n.t("prayerTimes.maghrib")},`) })
  );
  await user.press(
    screen.getByRole("switch", {
      name: new RegExp(`^${i18n.t("prayerDetail.athan.title")},`),
      ...hidden,
    })
  );
  await user.press(
    screen.getByRole("switch", {
      name: new RegExp(`^${i18n.t("prayerDetail.iqama.title")},`),
      ...hidden,
    })
  );
  await settle();
  return user;
};

describe("The prayer sheet's edit session", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
      hasError: false,
      isLoading: false,
    });
    scheduler.mockClear();
    Object.defineProperty(AppState, "currentState", {
      value: APP_STATE.ACTIVE,
      configurable: true,
    });
  });
  afterEach(() => jest.useRealTimers());
  afterAll(() => {
    if (CURRENT_STATE) Object.defineProperty(AppState, "currentState", CURRENT_STATE);
  });

  it("holds every change while the sheet is open", async () => {
    await openAndEdit();

    expect(scheduler).not.toHaveBeenCalled();
  });

  it("reschedules once when the sheet closes", async () => {
    const user = await openAndEdit();

    const [close] = screen
      .getAllByRole("button", { name: i18n.t("common.close"), ...hidden })
      .filter((each) => each.props.testID === undefined);
    await user.press(close);
    await settle();

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("reschedules once when a row inside it opens another screen", async () => {
    const user = await openAndEdit();

    await user.press(
      screen.getByRole("button", {
        name: new RegExp(`^${i18n.t("prayerDetail.adjustment.title")}`),
        ...hidden,
      })
    );
    await settle();

    expect(screen.getByText(PROVIDER_SCREEN)).toBeOnTheScreen();
    expect(scheduler).toHaveBeenCalledTimes(1);
  });
});

describe("The prayer sheet's reader focus", () => {
  const focusEvent = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
      hasError: false,
      isLoading: false,
    });
    focusEvent.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("returns to the card that opened the sheet once it closes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderToday();
    const card = screen.getByRole("button", {
      name: new RegExp(`^${i18n.t("prayerTimes.maghrib")},`),
    });
    await user.press(card);

    const [close] = screen
      .getAllByRole("button", { name: i18n.t("common.close"), ...hidden })
      .filter((each) => each.props.testID === undefined);
    await user.press(close);
    await settle();

    // jest's View mock hands a ref its component, props included.
    const [node, event] = focusEvent.mock.lastCall ?? [];
    expect(event).toBe("focus");
    expect(node instanceof Component && node.props.accessibilityLabel).toBe(
      card.props.accessibilityLabel
    );
  });
});
