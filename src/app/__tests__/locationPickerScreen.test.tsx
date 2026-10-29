// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import LocationPickerScreen from "@/app/settings/location-picker";
import LocationScreen from "@/app/settings/location";
import { act, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";

import { LOCATION_UPDATE_PART } from "@/components/LocationUpdateProgress";
import { PLACE_HERO_PART } from "@/components/ui/place-hero";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { CITY_PICKER_VIEW, LOCATION_PICKER } from "@/constants/Location";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { MAKKAH_CITY, placeFacts } from "@/test-helpers/place";
import { later } from "@/test-helpers/promises";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { initialLocationDetails } from "@/types/location";
import { checkLocationPermission } from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
// Reached through the notification store; its database never opens here.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/alarmScheduler", () => ({ rescheduleAllAlarms: jest.fn(async () => {}) }));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  checkLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
}));

/** The stubs' controls; read lazily inside the hoisted mocks. */
const MOCK_ID = {
  PICK: "stub-pick",
  SAVE: "stub-save",
  TO_COORDINATES: "stub-to-coordinates",
} as const;
const { PICK, SAVE, TO_COORDINATES } = MOCK_ID;

// The pickers' own tests cover search and fields; these hand on a place.
jest.mock("@/components/location/CityPicker", () => {
  const { createElement, Fragment } = jest.requireActual("react");
  const { Pressable } = jest.requireActual("react-native");
  const CityPickerStub = (props: {
    onPick: (place: unknown) => void;
    onEnterCoordinates: () => void;
  }) =>
    createElement(
      Fragment,
      null,
      createElement(Pressable, { testID: MOCK_ID.PICK, onPress: () => props.onPick(mockPlace) }),
      createElement(Pressable, {
        testID: MOCK_ID.TO_COORDINATES,
        onPress: props.onEnterCoordinates,
      })
    );
  return { __esModule: true, default: CityPickerStub };
});
jest.mock("@/components/location/CoordinateEntry", () => {
  const { createElement } = jest.requireActual("react");
  const { Pressable } = jest.requireActual("react-native");
  const CoordinateEntryStub = (props: { onSave: (place: unknown) => void }) =>
    createElement(Pressable, { testID: MOCK_ID.SAVE, onPress: () => props.onSave(mockPlace) });
  return { __esModule: true, default: CoordinateEntryStub };
});
const mockPlace = MAKKAH_CITY;

const t = i18n.t.bind(i18n);
const PICKER_ROUTE = BACK_DESTINATION.SETTINGS_LOCATION_PICKER.route;
const PICKER_HREF = BACK_DESTINATION.SETTINGS_LOCATION_PICKER.href;
const coordinatesUrl = `${PICKER_HREF}?${LOCATION_PICKER.viewParam}=${CITY_PICKER_VIEW.COORDINATES}`;

const header = (key: string) => screen.queryByRole("header", { name: t(key) });

const renderPicker = (url: string, { withRoot = false } = {}) =>
  renderRouter(
    {
      ...(withRoot
        ? {
            [BACK_DESTINATION.HOME.route]: () => null,
            [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <LocationScreen />,
          }
        : {}),
      [PICKER_ROUTE]: () => <LocationPickerScreen />,
    },
    { initialUrl: url, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

/** Opens `under`, then the picker over it, as a person reaches it. */
const openOver = async (under: string, url: string) => {
  const opened = await renderPicker(under, { withRoot: true });
  await act(async () => router.push(url));
  return opened;
};

/** Opens the root, then the picker over it. */
const openFromRoot = (url: string) => openOver(BACK_DESTINATION.SETTINGS_LOCATION.href, url);

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  jest.mocked(checkLocationPermission).mockResolvedValue({ granted: true, canAskAgain: true });
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
    locationDetails: { ...initialLocationDetails, address: { city: "Riyadh", country: "SA" } },
    isGettingLocation: false,
  });
  placeFacts(false, { latitude: 24.7136, longitude: 46.6753 });
  useLocationUpdateStore.setState({ run: null });
  useNotificationStore.setState({
    scheduleAllNotifications: jest.fn(async () => ({ success: true, scheduledCount: 0 })),
  });
});

describe("Settings › Location › city picker", () => {
  it("opens on the city list by default", async () => {
    await renderPicker(PICKER_HREF);

    expect(header("location.picker.title")).toBeTruthy();
  });

  // A failed read offers coordinates straight away.
  it("opens on the coordinates when asked to", async () => {
    await renderPicker(coordinatesUrl);

    expect(header("location.coordinates.title")).toBeTruthy();
  });

  it("heads the coordinates with a hero naming where the time zone comes from", async () => {
    await renderPicker(coordinatesUrl);

    expect(screen.getByTestId(PLACE_HERO_PART.FRAME)).toHaveAccessibleName(
      t("a11y.join", {
        first: t("a11y.join", {
          first: t("location.hero.coordinatesKicker"),
          second: t("location.hero.coordinatesTitle"),
        }),
        second: t("location.hero.coordinatesNote"),
      })
    );
  });

  it("draws no hero over the city list", async () => {
    await renderPicker(PICKER_HREF);

    expect(screen.queryByTestId(PLACE_HERO_PART.FRAME)).toBeNull();
  });

  // Back from coordinates is one step: the list, then Location.
  it("returns to the list from coordinates reached through it", async () => {
    const opened = await openFromRoot(PICKER_HREF);

    await userEvent.press(screen.getByTestId(TO_COORDINATES));
    expect(header("location.coordinates.title")).toBeTruthy();

    await userEvent.press(
      screen.getByRole("button", {
        name: t("a11y.backTo", { screen: t("location.picker.title") }),
      })
    );

    expect(header("location.picker.title")).toBeTruthy();
    expect(opened.getPathname()).toBe(normalizeRoutePath(PICKER_HREF));
  });

  describe("handing a chosen place to Location", () => {
    it.each([
      ["a city from the list", PICKER_HREF, PICK],
      ["typed coordinates", coordinatesUrl, SAVE],
    ])("shows the update on Location for %s, then the new place", async (_, url, control) => {
      const times = later<boolean>();
      // The real load settles the place once its days are read back.
      const load = jest.fn(async () => {
        const landed = await times.promise;
        useLocationStore.getState().settlePlace(useLocationStore.getState().placeRevision);
        return landed;
      });
      usePrayerTimesStore.setState({ loadPrayerTimesAtCurrentPlace: load });
      const opened = await openFromRoot(url);

      await userEvent.press(screen.getByTestId(control));

      // Back on Location at once, its steps on screen while the times load.
      expect(opened.getPathname()).toBe(
        normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
      );
      expect(await screen.findByTestId(LOCATION_UPDATE_PART.FRAME)).toBeTruthy();
      expect(useLocationStore.getState().manualLocation).toEqual(MAKKAH_CITY);
      expect(load).toHaveBeenCalledWith(true);

      await act(async () => times.release(true));

      expect(screen.queryByTestId(LOCATION_UPDATE_PART.FRAME)).toBeNull();
      expect(await screen.findByTestId(PLACE_HERO_PART.FRAME)).toHaveAccessibleName(
        t("a11y.join", {
          first: t("a11y.join", {
            first: t("location.hero.cityKicker"),
            second: t("place.name", { city: "Makkah", country: "Saudi Arabia" }),
          }),
          second: t("location.hero.cityNote"),
        })
      );
    });

    it("returns past the list when coordinates were reached through it", async () => {
      usePrayerTimesStore.setState({ loadPrayerTimesAtCurrentPlace: jest.fn(async () => true) });
      const opened = await openFromRoot(PICKER_HREF);
      await userEvent.press(screen.getByTestId(TO_COORDINATES));

      await userEvent.press(screen.getByTestId(SAVE));

      expect(opened.getPathname()).toBe(
        normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
      );
      expect(header("settings.location.title")).toBeTruthy();
    });

    // The city-change sheet opens the picker over any screen.
    it.each([
      ["a city from the list", [PICK]],
      ["coordinates reached through the list", [TO_COORDINATES, SAVE]],
    ])("goes back past Location to the screen under the picker for %s", async (_, controls) => {
      usePrayerTimesStore.setState({ loadPrayerTimesAtCurrentPlace: jest.fn(async () => true) });
      const opened = await openOver(BACK_DESTINATION.HOME.href, PICKER_HREF);

      for (const control of controls) await userEvent.press(screen.getByTestId(control));
      expect(opened.getPathname()).toBe(
        normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
      );
      await act(async () => router.back());

      expect(opened.getPathname()).toBe(normalizeRoutePath(BACK_DESTINATION.HOME.href));
    });

    it("lands a failed update in Location's failure card", async () => {
      usePrayerTimesStore.setState({
        loadPrayerTimesAtCurrentPlace: jest.fn(async () => {
          throw new Error("offline");
        }),
      });
      const opened = await openFromRoot(PICKER_HREF);

      await userEvent.press(screen.getByTestId(PICK));

      expect(await screen.findByRole("button", { name: t("common.retry") })).toBeTruthy();
      expect(screen.getByText(t("today.failed.title"))).toBeTruthy();
      expect(opened.getPathname()).toBe(
        normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
      );
    });
  });
});
