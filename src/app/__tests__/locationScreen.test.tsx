// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import LocationScreen from "@/app/settings/location";
import { AccessibilityInfo, Linking, Platform, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, usePathname } from "expo-router";
import { act, userEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { PLACE_HERO_PART } from "@/components/ui/place-hero";
import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
import {
  CITY_PICKER_VIEW,
  FIX_SOURCE,
  LOCATION_FAILURE,
  LOCATION_PICKER,
} from "@/constants/Location";
import { AppLocale, PlatformType } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { captureAppState, emitAppState } from "@/test-helpers/appStateMock";
import { placeFacts } from "@/test-helpers/place";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import {
  LocationFixError,
  checkLocationPermission,
  requestLocationPermission,
} from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
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

const t = i18n.t.bind(i18n);
const MINUTE = 60_000;
const PLATFORM = Platform.OS;
/** The md button's height: an inline button, not a footer's. */
const MD_BUTTON_HEIGHT = 50;

const RIYADH = { city: "Riyadh", country: "Saudi Arabia" };
const RIYADH_COORDS = { latitude: 24.7136, longitude: 46.6753 };
const MAKKAH: ManualLocation = {
  cityId: 104515,
  name: "Makkah",
  names: { ar: "مكة المكرمة", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } },
  latitude: 21.4225,
  longitude: 39.8262,
  timezone: "Asia/Riyadh",
};

const mockUpdate = jest.fn(async () => {});
const mockAdopt = jest.fn(async () => {});
const mockLoad = jest.fn(async () => {});

/** The picker route, printing what it was opened on. */
const Picker = () => {
  const params = useLocalSearchParams();
  return (
    <Text testID="pathname">
      {usePathname()}?{String(params[LOCATION_PICKER.viewParam])}
    </Text>
  );
};

const renderScreen = ({ isRTL = false } = {}) =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <LocationScreen />,
      [LOCATION_PICKER.href.slice(1)]: () => <Picker />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_LOCATION.href as string,
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

const permit = (granted: boolean, canAskAgain = true) =>
  jest.mocked(checkLocationPermission).mockResolvedValue({ granted, canAskAgain });

/** The device found Riyadh `minutesAgo` before now, its times verified. */
const deviceAt = (
  minutesAgo = 12,
  fixSource: (typeof FIX_SOURCE)[keyof typeof FIX_SOURCE] = FIX_SOURCE.FRESH
) => {
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    localizedLocation: RIYADH,
    locationDetails: {
      ...initialLocationDetails,
      address: RIYADH,
      fixSource,
      fixedAt: Date.now() - minutesAgo * MINUTE,
    },
  });
  placeFacts(false, RIYADH_COORDS);
};

const pathname = () => screen.getByTestId("pathname");
const hero = () => screen.getByTestId(PLACE_HERO_PART.FRAME);
const heroName = (kicker: string, title: string, note: string) =>
  t("a11y.join", { first: t("a11y.join", { first: kicker, second: title }), second: note });
const placeName = t("place.name", RIYADH);
/** The hero while no place is known: the question, and the ways to answer. */
const noPlaceHero = () =>
  heroName(
    t("settings.location.title"),
    t("onboarding.location.question"),
    t("location.hero.askNote")
  );
/** The choose-city row, read with its note. */
const chooseCityName = (note: string) =>
  t("a11y.join", { first: t("onboarding.location.chooseCity"), second: t(note) });
const failWith = (kind: (typeof LOCATION_FAILURE)[keyof typeof LOCATION_FAILURE]) =>
  useLocationStore.setState((state) => ({
    locationDetails: { ...state.locationDetails, error: kind },
  }));

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  permit(true);
  jest.mocked(requestLocationPermission).mockResolvedValue({ granted: true });
  mockUpdate.mockResolvedValue(undefined);
  mockAdopt.mockResolvedValue(undefined);
  mockLoad.mockResolvedValue(undefined);
  useLocationStore.setState({
    updateCurrentLocation: mockUpdate,
    adoptDeviceLocation: mockAdopt,
    autoUpdateLocation: true,
    isGettingLocation: false,
  });
  usePrayerTimesStore.setState({ loadPrayerTimes: mockLoad });
  useNotificationStore.setState({
    scheduleAllNotifications: jest.fn(async () => ({ success: true, scheduledCount: 0 })),
  });
  deviceAt();
});

afterEach(() => {
  Platform.OS = PLATFORM;
  jest.restoreAllMocks();
});

describe("Settings › Location", () => {
  it("draws the sky behind its content, under its title", async () => {
    await renderScreen();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByRole("header", { name: t("settings.location.title") })).toBeTruthy();
  });

  describe("on the device's location", () => {
    it("names the device's place on its hero", async () => {
      await renderScreen();

      expect(await screen.findByTestId(PLACE_HERO_PART.FRAME)).toHaveAccessibleName(
        heroName(t("location.hero.deviceKicker"), placeName, t("location.hero.deviceNote"))
      );
    });

    it("chooses between the device and a city in one radio group, the device chosen", async () => {
      await renderScreen();

      const group = await screen.findByLabelText(t("a11y.location.mode"));
      expect(group).toHaveProp("accessibilityRole", "radiogroup");
      expect(
        within(group).getByRole("radio", {
          name: t("onboarding.location.automatic"),
          selected: true,
        })
      ).toBeTruthy();
    });

    it("says when the device last found the place, and refreshes it", async () => {
      await renderScreen();
      const name = t("a11y.join", {
        first: t("location.device.refresh"),
        second: t("location.device.lastFound.minutes", { count: 12 }),
      });
      const row = await screen.findByRole("button", { name });

      expect(row).toHaveProp("accessibilityHint", t("a11y.location.refreshHint"));
      await userEvent.press(row);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockLoad).toHaveBeenCalledWith(true);
    });

    it("suggests an update on opening in another city, under its label", async () => {
      await renderScreen();
      expect(
        await screen.findByRole("header", { name: t("location.settings.travelSection") })
      ).toBeTruthy();
      const toggle = screen.getByRole("switch", {
        name: `${t("location.settings.keepLocationUpdated.title")}, ${t(
          "location.settings.keepLocationUpdated.summary"
        )}`,
      });
      // The name and summary already say when; no hint repeats it.
      expect(toggle.props.accessibilityHint).toBeUndefined();

      await userEvent.press(toggle);

      expect(useLocationStore.getState().autoUpdateLocation).toBe(false);
    });

    it("says when the place came from the device's last recorded fix", async () => {
      deviceAt(30, FIX_SOURCE.LAST_KNOWN);
      await renderScreen();

      expect(await screen.findByLabelText(t("location.lastKnownNotice"))).toBeTruthy();
    });

    it("says the times are Makkah's while no place is verified, and asks for one", async () => {
      placeFacts(true, null);
      await renderScreen();

      expect(await screen.findByLabelText(t("today.defaultLocation.body"))).toBeTruthy();
      expect(hero()).toHaveAccessibleName(noPlaceHero());
    });

    // A read runs for seconds; the place cannot change under it.
    it("holds the city choice and the refresh while a read runs", async () => {
      mockUpdate.mockReturnValue(new Promise(() => {}));
      await renderScreen();
      const refresh = await screen.findByRole("button", {
        name: new RegExp(`^${t("location.device.refresh")}`),
      });

      await userEvent.press(refresh);
      await userEvent.press(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY));

      expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toBeDisabled();
      expect(refresh).toBeDisabled();
      expect(screen.queryByTestId("pathname")).toBeNull();
    });

    it("holds its controls while a read started elsewhere runs", async () => {
      useLocationStore.setState({ isGettingLocation: true });
      await renderScreen();

      expect(await screen.findByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toBeDisabled();
      expect(
        screen.getByRole("button", { name: new RegExp(`^${t("location.device.refresh")}`) })
      ).toBeDisabled();
    });
  });

  // The CI flow chooses a city from whichever state the device is in.
  describe("the choose-city control the CI flow taps", () => {
    it.each([
      ["the device's location", () => permit(true)],
      ["no permission yet", () => permit(false, true)],
      ["a refused permission", () => permit(false, false)],
      ["a chosen city", () => useLocationStore.getState().setManualLocation(MAKKAH)],
      [
        "a failed read",
        () =>
          useLocationStore.setState((state) => ({
            locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
          })),
      ],
    ])("opens the city list from %s", async (_state, arrange) => {
      arrange();
      await renderScreen();

      await userEvent.press(await screen.findByTestId(E2E_ID.LOCATION_CHOOSE_CITY));

      expect(pathname()).toHaveTextContent(
        `${normalizeRoutePath(LOCATION_PICKER.href)}?${CITY_PICKER_VIEW.LIST}`
      );
    });
  });

  describe("on a chosen city", () => {
    beforeEach(() => useLocationStore.getState().setManualLocation(MAKKAH));

    it("names the city in the app's language on its own tint", async () => {
      await act(() => i18n.changeLanguage(AppLocale.AR));
      await renderScreen({ isRTL: true });

      expect(await screen.findByTestId(PLACE_HERO_PART.FRAME)).toHaveAccessibleName(
        heroName(
          t("location.hero.cityKicker"),
          t("place.name", { city: "مكة المكرمة", country: "السعودية" }),
          t("location.hero.cityNote")
        )
      );
    });

    it("says the device's location is not used, with the city chosen", async () => {
      await renderScreen();

      expect(await screen.findByLabelText(t("location.manual.notice"))).toBeTruthy();
      expect(
        screen.getByRole("radio", { name: t("onboarding.location.city"), selected: true })
      ).toBeTruthy();
    });

    it("switches back to the device, which reads before it replaces the city", async () => {
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      );

      expect(requestLocationPermission).not.toHaveBeenCalled();
      expect(mockAdopt).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("asks for location access first when it has none", async () => {
      permit(false, true);
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      );

      expect(requestLocationPermission).toHaveBeenCalledTimes(1);
      expect(mockAdopt).toHaveBeenCalledTimes(1);
    });

    it("keeps the city and points to Settings when access is refused", async () => {
      permit(false, false);
      jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
      const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      );

      expect(mockAdopt).not.toHaveBeenCalled();
      expect(screen.getByLabelText(t("location.manual.deviceRefused"))).toBeTruthy();
      expect(
        StyleSheet.flatten(
          screen.getByRole("button", { name: t("location.permission.openSettings") }).props.style
        ).minHeight
      ).toBe(MD_BUTTON_HEIGHT);
      await userEvent.press(
        screen.getByRole("button", { name: t("location.permission.openSettings") })
      );
      expect(openSettings).toHaveBeenCalledTimes(1);
      expect(useLocationStore.getState().manualLocation).toEqual(MAKKAH);
    });

    // A live region speaks on Android only; VoiceOver hears it said.
    it("says on iOS that access is refused when the device is chosen", async () => {
      Platform.OS = PlatformType.IOS;
      permit(false, false);
      jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      );

      expect(announce).toHaveBeenCalledWith(t("location.manual.deviceRefused"));
    });

    it("holds the mode and the city row while the switch to the device reads", async () => {
      mockAdopt.mockReturnValue(new Promise(() => {}));
      await renderScreen();
      const device = await screen.findByRole("radio", { name: t("onboarding.location.automatic") });

      await userEvent.press(device);
      await userEvent.press(device);

      expect(mockAdopt).toHaveBeenCalledTimes(1);
      expect(device).toBeDisabled();
      expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toBeDisabled();
    });
  });

  describe("with no location permission yet", () => {
    beforeEach(() => permit(false, true));

    it("asks which city, and offers the device or a city", async () => {
      await renderScreen();

      expect(await screen.findByTestId(PLACE_HERO_PART.FRAME)).toHaveAccessibleName(
        heroName(t("settings.location.title"), placeName, t("location.hero.askNote"))
      );
      expect(
        screen.getByRole("button", { name: chooseCityName("onboarding.location.cityNote") })
      ).toBeTruthy();
    });

    it("asks the system for access, then reads the device", async () => {
      await renderScreen();
      const row = await screen.findByRole("button", {
        name: t("a11y.join", {
          first: t("onboarding.location.automatic"),
          second: t("onboarding.location.automaticNote"),
        }),
      });

      await userEvent.press(row);

      expect(requestLocationPermission).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("reads nothing when the system prompt is declined", async () => {
      jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("button", {
          name: t("a11y.join", {
            first: t("onboarding.location.automatic"),
            second: t("onboarding.location.automaticNote"),
          }),
        })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // The notice answers a switch from a chosen city, not an earlier prompt.
  it("carries no refusal from the permission rows into a city chosen next", async () => {
    permit(false, true);
    jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
    await renderScreen();
    await userEvent.press(
      await screen.findByRole("button", {
        name: t("a11y.join", {
          first: t("onboarding.location.automatic"),
          second: t("onboarding.location.automaticNote"),
        }),
      })
    );

    await act(async () => useLocationStore.getState().setManualLocation(MAKKAH));

    expect(await screen.findByLabelText(t("location.manual.notice"))).toBeTruthy();
    expect(screen.queryByLabelText(t("location.manual.deviceRefused"))).toBeNull();
  });

  describe("with location access refused", () => {
    beforeEach(() => permit(false, false));

    it("says so, keeps the times where they are, and opens the app's settings", async () => {
      const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
      await renderScreen();

      expect(await screen.findByLabelText(t("location.denied.notice"))).toBeTruthy();
      expect(hero()).toHaveAccessibleName(
        heroName(t("location.hero.deniedKicker"), placeName, t("location.hero.deniedNote"))
      );
      const button = screen.getByRole("button", { name: t("location.permission.openSettings") });
      expect(button).toHaveProp("accessibilityHint", t("a11y.location.openSettingsHint"));
      await userEvent.press(button);

      expect(openSettings).toHaveBeenCalledTimes(1);
    });

    // No saved place stands in: the times are Makkah's.
    it("says the times are Makkah's when no place was ever found", async () => {
      placeFacts(true, null);
      await renderScreen();

      expect(await screen.findByLabelText(t("today.defaultLocation.body"))).toBeTruthy();
      expect(screen.queryByLabelText(t("location.denied.notice"))).toBeNull();
    });

    it("checks again on return from Settings, without a spinner in between", async () => {
      captureAppState();
      await renderScreen();
      await screen.findByLabelText(t("location.denied.notice"));
      permit(true);

      await act(async () => emitAppState("background", "active"));

      expect(checkLocationPermission).toHaveBeenCalledTimes(2);
      expect(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      ).toBeTruthy();
    });
  });

  describe("after a failed read", () => {
    // The stored kind becomes copy; the raw kind never shows.
    it.each([
      [LOCATION_FAILURE.TIMEOUT, "location.failure.notFound.title"],
      [LOCATION_FAILURE.UNAVAILABLE, "location.failure.notFound.title"],
      [LOCATION_FAILURE.SERVICES_OFF, "location.failure.servicesOff.title"],
    ])("shows the %s failure as its own copy, the saved place kept", async (kind, key) => {
      failWith(kind);
      await renderScreen();

      expect(await screen.findByText(t(key))).toBeOnTheScreen();
      expect(screen.queryByText(kind)).toBeNull();
      expect(hero()).toHaveAccessibleName(
        heroName(t("location.hero.savedKicker"), placeName, t("location.hero.savedNote"))
      );
    });

    // No place was ever found, so none is kept: the times are Makkah's.
    it("claims no saved place when none was found", async () => {
      placeFacts(true, null);
      failWith(LOCATION_FAILURE.TIMEOUT);
      await renderScreen();

      expect(await screen.findByText(t("location.failure.notFound.title"))).toBeOnTheScreen();
      expect(hero()).toHaveAccessibleName(noPlaceHero());
      expect(screen.getByLabelText(t("today.defaultLocation.body"))).toBeTruthy();
    });

    it("keeps a chosen city's tint and name when the switch to the device fails", async () => {
      useLocationStore.getState().setManualLocation(MAKKAH);
      mockAdopt.mockImplementation(async () => {
        failWith(LOCATION_FAILURE.TIMEOUT);
        throw new LocationFixError(LOCATION_FAILURE.TIMEOUT);
      });
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      );

      expect(await screen.findByText(t("location.failure.notFound.title"))).toBeOnTheScreen();
      expect(hero()).toHaveAccessibleName(
        heroName(
          t("location.hero.savedKicker"),
          t("place.name", { city: MAKKAH.name, country: MAKKAH.country.name }),
          t("location.hero.savedNote")
        )
      );
    });

    // A refusal stored before access was given is not this read's failure.
    it("shows a stored refusal as the refused state while access is off", async () => {
      failWith(LOCATION_FAILURE.DENIED);
      permit(false, false);
      await renderScreen();

      expect(await screen.findByLabelText(t("location.denied.notice"))).toBeTruthy();
      expect(screen.queryByText(LOCATION_FAILURE.DENIED)).toBeNull();
    });

    it("drops a stored refusal once access is given", async () => {
      failWith(LOCATION_FAILURE.DENIED);
      await renderScreen();

      expect(
        await screen.findByRole("radio", { name: t("onboarding.location.automatic") })
      ).toBeTruthy();
      expect(screen.queryByText(t("location.failure.denied.title"))).toBeNull();
    });

    it("retries the device read", async () => {
      failWith(LOCATION_FAILURE.TIMEOUT);
      await renderScreen();

      await userEvent.press(await screen.findByRole("button", { name: t("common.retry") }));

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("opens the coordinates for a place the list lacks", async () => {
      failWith(LOCATION_FAILURE.TIMEOUT);
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("button", {
          name: t("a11y.join", {
            first: t("location.picker.enterCoordinates"),
            second: t("location.failure.coordinatesNote"),
          }),
        })
      );

      expect(pathname()).toHaveTextContent(
        `${normalizeRoutePath(LOCATION_PICKER.href)}?${CITY_PICKER_VIEW.COORDINATES}`
      );
    });

    it("offers the way out after its own refresh fails", async () => {
      mockUpdate.mockImplementation(async () => {
        failWith(LOCATION_FAILURE.TIMEOUT);
        throw new LocationFixError(LOCATION_FAILURE.TIMEOUT);
      });
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("button", {
          name: new RegExp(`^${t("location.device.refresh")}`),
        })
      );

      expect(await screen.findByText(t("location.failure.notFound.title"))).toBeTruthy();
    });

    // The read landed: the hero names the place in use and claims nothing kept.
    it("says the times failed when the read worked and the load did not", async () => {
      mockLoad.mockRejectedValue(new Error("offline"));
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("button", {
          name: new RegExp(`^${t("location.device.refresh")}`),
        })
      );

      expect(await screen.findByText(t("today.failed.title"))).toBeTruthy();
      expect(hero()).toHaveAccessibleName(
        heroName(t("location.hero.deviceKicker"), placeName, t("location.hero.deviceNote"))
      );
    });

    // The times loaded; the step's own line reports it, not the place's panel.
    it.each([
      [
        "notifications",
        () =>
          useNotificationStore.setState({
            scheduleAllNotifications: jest.fn(async () => {
              throw new Error("denied");
            }),
          }),
      ],
      [
        "alarms",
        () =>
          jest.mocked(rescheduleAllAlarms).mockImplementation(async () => {
            throw new Error("busy");
          }),
      ],
    ])("keeps the device's state when %s fail after the times load", async (_step, arrange) => {
      arrange();
      await renderScreen();

      await userEvent.press(
        await screen.findByRole("button", {
          name: new RegExp(`^${t("location.device.refresh")}`),
        })
      );

      expect(await screen.findByLabelText(t("location.update.error"))).toBeTruthy();
      expect(screen.queryByText(t("today.failed.title"))).toBeNull();
      expect(hero()).toHaveAccessibleName(
        heroName(t("location.hero.deviceKicker"), placeName, t("location.hero.deviceNote"))
      );
    });

    it("points to Settings when access is gone after a failed read", async () => {
      captureAppState();
      mockUpdate.mockImplementation(async () => {
        failWith(LOCATION_FAILURE.TIMEOUT);
        throw new LocationFixError(LOCATION_FAILURE.TIMEOUT);
      });
      await renderScreen();
      await userEvent.press(
        await screen.findByRole("button", {
          name: new RegExp(`^${t("location.device.refresh")}`),
        })
      );
      await screen.findByText(t("location.failure.notFound.title"));
      permit(false, false);

      await act(async () => emitAppState("background", "active"));

      expect(
        await screen.findByRole("button", { name: t("location.permission.openSettings") })
      ).toBeTruthy();
      expect(screen.queryByText(t("location.failure.notFound.title"))).toBeNull();
    });
  });

  it("mirrors the mode control in Arabic", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderScreen({ isRTL: true });

    const group = await screen.findByLabelText(t("a11y.location.mode"));
    expect(StyleSheet.flatten(group.props.style).direction).toBe("rtl");
  });
});
