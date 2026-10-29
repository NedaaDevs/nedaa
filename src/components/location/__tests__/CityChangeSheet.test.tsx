// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// sheet must bind to the mock below, not to its empty one.
import { CityChangeSheet } from "@/components/location/CityChangeSheet";
import { Component } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { useLocalSearchParams, usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { Theme } from "tamagui";

import {
  CITY_PICKER_VIEW,
  LOCATION_FAILURE,
  LOCATION_PICKER,
  UPDATE_START,
  UPDATE_STEP,
} from "@/constants/Location";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { LOCATION_UPDATE_PART } from "@/components/LocationUpdateProgress";
import { DEFAULT_FACES } from "@/constants/Fonts";
import { NEDAA_DARK } from "@/constants/Palette";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { initialLocationDetails } from "@/types/location";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { LocationFixError } from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
// Reached through the notification store; its database never opens here.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/alarmScheduler", () => ({ rescheduleAllAlarms: jest.fn(async () => {}) }));

const t = i18n.t.bind(i18n);
const OFFER = { currentCity: "Riyadh", newCity: "Jeddah" };

const { closeCityChange } = useLocationStore.getState();
const mockUpdate = jest.fn(async () => {});
const mockLoad = jest.fn(async () => true);

/** The picker route, printing what it was opened on. */
const Picker = () => {
  const params = useLocalSearchParams();
  return (
    <Text testID="pathname">
      {usePathname()}?{String(params[LOCATION_PICKER.viewParam])}
    </Text>
  );
};

const renderSheet = ({ isRTL = false, dark = false, onboarding = false } = {}) =>
  renderRouter(
    {
      index: () =>
        dark ? (
          <Theme name="dark">
            <CityChangeSheet onboarding={onboarding} />
          </Theme>
        ) : (
          <CityChangeSheet onboarding={onboarding} />
        ),
      [BACK_DESTINATION.SETTINGS_LOCATION_PICKER.route]: () => <Picker />,
    },
    {
      initialUrl: "/",
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

const title = () => screen.queryByRole("header", { name: t("location.cityChange.title") });
const updateButton = () => screen.getByRole("button", { name: t("location.cityChange.update") });
const box = (label: string, city: string) =>
  screen.getByLabelText(t("a11y.join", { first: t(label), second: city }));

/** A run that stays at its first step until the test lets it land. */
const holdUpdate = () => {
  let land: () => void = () => {};
  mockUpdate.mockReturnValue(new Promise<void>((resolve) => (land = resolve)));
  return () => land();
};

// jest's View mock hands a ref its component, props included.
const headerFocuses = (focus: jest.SpyInstance) =>
  focus.mock.calls.filter(
    ([node]) => node instanceof Component && node.props.accessibilityRole === "header"
  ).length;

/** Updates that fail at the read, storing the kind the way the store does. */
const failReads = () =>
  mockUpdate.mockImplementation(async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
    }));
    throw new LocationFixError(LOCATION_FAILURE.TIMEOUT);
  });

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockUpdate.mockResolvedValue(undefined);
  mockLoad.mockResolvedValue(true);
  useLocationUpdateStore.setState({ run: null });
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    locationDetails: { ...initialLocationDetails, address: { city: "Riyadh", country: "SA" } },
    updateCurrentLocation: mockUpdate,
    closeCityChange,
    cityOffered: null,
  });
  useLocationStore.getState().offerCityChange(OFFER);
  usePrayerTimesStore.setState({ loadPrayerTimes: mockLoad });
  useNotificationStore.setState({
    scheduleAllNotifications: jest.fn(async () => ({ success: true, scheduledCount: 0 })),
  });
});

describe("CityChangeSheet", () => {
  it("offers the city the device is in against the saved one", async () => {
    await renderSheet();

    expect(title()).toBeTruthy();
    expect(box("location.cityChange.saved", OFFER.currentCity)).toBeTruthy();
    expect(box("location.cityChange.now", OFFER.newCity)).toBeTruthy();
    expect(screen.getByText(t("location.cityChanged.description"))).toBeTruthy();
    expect(updateButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: t("location.cityChange.keep") })).toBeTruthy();
  });

  // The row follows the reading direction: the saved city at the start edge.
  it("reads the saved city first in Arabic, with no arrow between", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderSheet({ isRTL: true });

    const saved = box("location.cityChange.saved", OFFER.currentCity);
    const now = box("location.cityChange.now", OFFER.newCity);
    const boxes = screen.getAllByLabelText(/Riyadh|Jeddah/);
    expect(boxes).toEqual([saved, now]);
    expect(screen.queryByText("↓")).toBeNull();
  });

  it("never shows over onboarding", async () => {
    await renderSheet({ onboarding: true });

    expect(title()).toBeNull();
  });

  it("shows no earlier run's failure when it opens", async () => {
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.DEVICE }, step: UPDATE_STEP.LOCATION, failed: true },
    });
    await renderSheet();

    expect(updateButton()).toBeTruthy();
    expect(screen.queryByText(t("location.failure.notFound.title"))).toBeNull();
  });

  it("stays open through the update with its steps, and closes once it lands", async () => {
    let land: () => void = () => {};
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => (land = resolve)));
    await renderSheet();

    await userEvent.press(updateButton());

    expect(await screen.findByLabelText(t("onboarding.fetch.locatingDevice"))).toBeTruthy();
    expect(title()).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("location.cityChange.update") })).toBeNull();

    await act(async () => land());

    expect(mockLoad).toHaveBeenCalledWith(true);
    expect(title()).toBeNull();
    expect(useLocationStore.getState().pendingCityChange).toBeNull();
  });

  // The sheet leaves on what it was doing, not on the question it answered.
  it("keeps the run's steps, not the offer, while it leaves", async () => {
    const closeCityChange = jest.fn();
    useLocationStore.setState({ closeCityChange });
    await renderSheet();

    await userEvent.press(updateButton());

    expect(closeCityChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(LOCATION_UPDATE_PART.STEPS)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("location.cityChange.update") })).toBeNull();
  });

  // Content swaps under the reader; focus goes back to the sheet's title.
  it("moves reader focus to its title when the run and its failure show", async () => {
    failReads();
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    await renderSheet();
    const opened = headerFocuses(focus);

    await userEvent.press(updateButton());

    expect(await screen.findByText(t("location.failure.notFound.title"))).toBeTruthy();
    expect(headerFocuses(focus)).toBeGreaterThanOrEqual(opened + 2);
  });

  it("names its buttons, and says what Update does", async () => {
    await renderSheet();

    expect(updateButton()).toHaveProp("accessibilityLabel", t("location.cityChange.update"));
    expect(updateButton()).toHaveProp("accessibilityHint", t("a11y.location.refreshHint"));
    expect(screen.getByRole("button", { name: t("location.cityChange.keep") })).toHaveProp(
      "accessibilityLabel",
      t("location.cityChange.keep")
    );
  });

  // Only a run this sheet started is drawn here.
  it("waits on a run begun elsewhere, drawing none of it", async () => {
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.DEVICE }, step: UPDATE_STEP.PRAYER_TIMES, failed: false },
    });
    await renderSheet();

    expect(updateButton()).toBeDisabled();
    await userEvent.press(updateButton());
    expect(screen.queryByTestId(LOCATION_UPDATE_PART.STEPS)).toBeNull();

    await act(async () => useLocationUpdateStore.setState({ run: null }));
    expect(updateButton()).toBeEnabled();
  });

  // Inside a sheet: rows on the soft row tone, panels flat, names at 600.
  it("draws the cities and its run on the sheet's own tones", async () => {
    holdUpdate();
    await renderSheet({ dark: true });

    expect(box("location.cityChange.saved", OFFER.currentCity)).toHaveStyle({
      backgroundColor: NEDAA_DARK.surface2Soft.hex,
    });
    expect(screen.getByText(OFFER.currentCity)).toHaveStyle({
      fontFamily: DEFAULT_FACES.semibold,
    });
    await userEvent.press(updateButton());
    expect(screen.getByTestId(LOCATION_UPDATE_PART.FRAME)).toHaveStyle({
      backgroundColor: NEDAA_DARK.panel.hex,
    });
  });

  it("keeps the saved city and offers this one no more this session", async () => {
    await renderSheet();

    await userEvent.press(screen.getByRole("button", { name: t("location.cityChange.keep") }));

    expect(title()).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(useLocationStore.getState().pendingCityChange).toBeNull();
    expect(useLocationStore.getState().cityOffered).toBe(OFFER.newCity);
  });

  // The failure card is the one way out of a failed read, here as on Location.
  it("shows the failure card in the sheet, and its retry reads the device again", async () => {
    failReads();
    await renderSheet();
    await userEvent.press(updateButton());

    expect(await screen.findByText(t("location.failure.notFound.title"))).toBeTruthy();
    mockUpdate.mockResolvedValue(undefined);
    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(title()).toBeNull();
  });

  it("opens the city list from the failure card, leaving the sheet", async () => {
    failReads();
    await renderSheet();
    await userEvent.press(updateButton());

    await userEvent.press(
      await screen.findByRole("button", {
        name: new RegExp(`^${t("onboarding.location.chooseCity")}`),
      })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      `${normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION_PICKER.href)}?${CITY_PICKER_VIEW.LIST}`
    );
    expect(title()).toBeNull();
    expect(useLocationUpdateStore.getState().run).toBeNull();
  });

  // The new place and its times are in; only what they set off stopped.
  it("says what a later step left undone, with a retry and a way to close", async () => {
    jest.mocked(rescheduleAllAlarms).mockRejectedValueOnce(new Error("busy"));
    await renderSheet();
    await userEvent.press(updateButton());

    expect(await screen.findByLabelText(t("location.update.failed.alarms"))).toBeTruthy();
    await userEvent.press(screen.getByRole("button", { name: t("common.close") }));

    expect(title()).toBeNull();
  });
});
