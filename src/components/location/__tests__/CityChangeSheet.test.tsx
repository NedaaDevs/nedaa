// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// sheet must bind to the mock below, not to its empty one.
import { CityChangeSheet } from "@/components/location/CityChangeSheet";
import { ACTIONSHEET_PART } from "@/components/ui/actionsheet";
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
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { LOCATION_UPDATE_PART } from "@/components/LocationUpdateProgress";
import { DEFAULT_FACES } from "@/constants/Fonts";
import { NEDAA_DARK } from "@/constants/Palette";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import { never } from "@/test-helpers/promises";
import { JEDDAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
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
const SAVED_CITY = RIYADH_CITY.name;
const NEW_CITY = JEDDAH_CITY.name;
const UNNAMED_KM = 40;

const { dismissCityOffer } = useLocationStore.getState();
const kept = () => useCityCheckStore.getState().cityCheck.kept;
const mockUpdate = jest.fn(async () => true);
const mockReadDevice = jest.fn(async () => {});
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
  mockUpdate.mockReturnValue(new Promise<boolean>((resolve) => (land = () => resolve(true))));
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
  mockUpdate.mockResolvedValue(true);
  mockLoad.mockResolvedValue(true);
  useLocationUpdateStore.setState({ run: null });
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    previousPlace: null,
    localizedLocation: { city: "", country: "" },
    locationDetails: {
      ...initialLocationDetails,
      address: { city: SAVED_CITY, country: RIYADH_CITY.country.name },
    },
    updateCurrentLocation: mockReadDevice,
    applyCityCandidate: mockUpdate,
    dismissCityOffer,
    cityOffer: null,
  });
  offerUp();
  usePrayerTimesStore.setState({ loadPrayerTimesAtCurrentPlace: mockLoad });
  useNotificationStore.setState({
    scheduleAllNotifications: jest.fn(async () => ({ success: true, scheduledCount: 0 })),
  });
});

describe("CityChangeSheet", () => {
  it("offers the city the device is in against the saved one", async () => {
    await renderSheet();

    expect(title()).toBeTruthy();
    expect(box("location.cityChange.saved", SAVED_CITY)).toBeTruthy();
    expect(box("location.cityChange.now", NEW_CITY)).toBeTruthy();
    expect(screen.getByText(t("location.cityChanged.description"))).toBeTruthy();
    expect(updateButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: t("location.cityChange.keep") })).toBeTruthy();
  });

  // The row follows the reading direction: the saved city at the start edge.
  it("reads the saved city first in Arabic, with no arrow between", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderSheet({ isRTL: true });

    const newCityAr = JEDDAH_CITY.names.ar ?? NEW_CITY;
    const saved = box("location.cityChange.saved", SAVED_CITY);
    const now = box("location.cityChange.now", newCityAr);
    const boxes = screen.getAllByLabelText(new RegExp(`${SAVED_CITY}|${newCityAr}`));
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
    mockUpdate.mockReturnValue(new Promise<boolean>((resolve) => (land = () => resolve(true))));
    await renderSheet();

    await userEvent.press(updateButton());

    expect(await screen.findByLabelText(t("location.update.step.city"))).toBeTruthy();
    expect(screen.queryByLabelText(t("onboarding.fetch.locatingDevice"))).toBeNull();
    expect(title()).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("location.cityChange.update") })).toBeNull();

    await act(async () => land());

    expect(mockLoad).toHaveBeenCalledWith(true);
    expect(title()).toBeNull();
    expect(useLocationStore.getState().cityOffer).toBeNull();
  });

  it("updates from the offered candidate and closes once it lands", async () => {
    const withRun = jest.spyOn(useLocationUpdateStore.getState(), "withRun");
    const candidate = candidateAt();
    offerUp(candidate);
    await renderSheet();

    await userEvent.press(updateButton());

    expect(withRun).toHaveBeenCalledWith(
      { kind: UPDATE_START.CANDIDATE, candidate },
      expect.any(Function)
    );
    expect(mockUpdate).toHaveBeenCalledWith(candidate);
    expect(useLocationStore.getState().cityOffer).toBeNull();
  });

  it("stays open, saying nothing is done, when the offered city is not written", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    mockUpdate.mockResolvedValue(false);
    await renderSheet();

    await userEvent.press(updateButton());

    expect(title()).toBeTruthy();
    expect(useLocationStore.getState().cityOffer).not.toBeNull();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalledWith(t("location.update.step.done"));
    expect(useLocationUpdateStore.getState().run).toEqual(
      expect.objectContaining({ step: UPDATE_STEP.LOCATION, failed: true })
    );
  });

  // The times land and settle the place while later steps still run.
  it("names the saved city as it was when the offer came, through the update", async () => {
    mockUpdate.mockImplementation(async () => {
      const before = useLocationStore.getState();
      useLocationStore.setState({
        previousPlace: {
          coords: before.locationDetails.coords,
          address: before.locationDetails.address,
          timezone: before.locationDetails.timezone,
          fixSource: null,
          fixedAt: null,
          countryCode: before.locationDetails.countryCode,
          localizedLocation: before.localizedLocation,
          locationMode: before.locationMode,
          manualLocation: null,
        },
        placeRevision: before.placeRevision + 1,
        locationDetails: {
          ...before.locationDetails,
          address: { city: NEW_CITY, country: JEDDAH_CITY.country.name },
        },
      });
      return true;
    });
    mockLoad.mockImplementation(async () => {
      const { settlePlace, placeRevision } = useLocationStore.getState();
      settlePlace(placeRevision);
      return true;
    });
    useNotificationStore.setState({ scheduleAllNotifications: () => never() });
    await renderSheet();

    await userEvent.press(updateButton());

    expect(useLocationStore.getState().previousPlace).toBeNull();
    expect(useLocationUpdateStore.getState().run?.step).toBe(UPDATE_STEP.NOTIFICATIONS);
    expect(box("location.cityChange.saved", SAVED_CITY)).toBeTruthy();
  });

  // The sheet leaves on what it was doing, not on the question it answered.
  it("keeps the run's steps, not the offer, while it leaves", async () => {
    const dismiss = jest.fn();
    useLocationStore.setState({ dismissCityOffer: dismiss });
    await renderSheet();

    await userEvent.press(updateButton());

    expect(dismiss).toHaveBeenCalledTimes(1);
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
    expect(updateButton()).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityChange.updateHint")
    );
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

    expect(box("location.cityChange.saved", SAVED_CITY)).toHaveStyle({
      backgroundColor: NEDAA_DARK.surface2Soft.hex,
    });
    expect(screen.getByText(SAVED_CITY)).toHaveStyle({
      fontFamily: DEFAULT_FACES.semibold,
    });
    await userEvent.press(updateButton());
    expect(screen.getByTestId(LOCATION_UPDATE_PART.FRAME)).toHaveStyle({
      backgroundColor: NEDAA_DARK.panel.hex,
    });
  });

  it("keeps the saved city for the trip when Keep is pressed", async () => {
    await renderSheet();

    await userEvent.press(screen.getByRole("button", { name: t("location.cityChange.keep") }));

    expect(title()).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(useLocationStore.getState().cityOffer).toBeNull();
    expect(kept()).toHaveLength(1);
  });

  it("remembers nothing when the sheet is swiped away", async () => {
    await renderSheet();

    await userEvent.press(screen.getByTestId(ACTIONSHEET_PART.SCRIM));

    expect(title()).toBeNull();
    expect(useLocationStore.getState().cityOffer).toBeNull();
    expect(kept()).toEqual([]);
  });

  it("names the new city from its city row in the app's language", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderSheet({ isRTL: true });

    expect(box("location.cityChange.now", JEDDAH_CITY.names.ar ?? NEW_CITY)).toBeTruthy();
  });

  it("shows the distance from the saved place for an unnamed candidate", async () => {
    offerUp(candidateAt({ name: null, distanceKm: UNNAMED_KM }));
    await renderSheet();

    expect(
      box(
        "location.cityChange.now",
        t("location.cityChange.unnamedPlace", { distance: UNNAMED_KM })
      )
    ).toBeTruthy();
  });

  it("hides the saved city box when the saved city has no name", async () => {
    useLocationStore.setState({
      locationDetails: { ...initialLocationDetails, address: null },
    });
    await renderSheet();

    expect(screen.queryByText(t("location.cityChange.saved"))).toBeNull();
    expect(box("location.cityChange.now", NEW_CITY)).toBeTruthy();
  });

  // The failure card is the one way out of a failed read, here as on Location.
  it("shows the failure card in the sheet, and its retry repeats the offered update", async () => {
    const candidate = candidateAt();
    offerUp(candidate);
    failReads();
    await renderSheet();
    await userEvent.press(updateButton());

    expect(await screen.findByText(t("location.failure.notFound.title"))).toBeTruthy();
    mockUpdate.mockResolvedValue(true);
    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));

    expect(mockUpdate.mock.calls).toEqual([[candidate], [candidate]]);
    expect(mockReadDevice).not.toHaveBeenCalled();
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
