// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import KeepLocationUpdated from "@/components/Location";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { checkLocationPermission } from "@/utils/location";
import i18n from "@/localization/i18n";
import { LOCATION_FAILURE } from "@/constants/Location";
import { useLocationStore } from "@/stores/location";
import { initialLocationDetails } from "@/types/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
// Reached through the notification store; its database never opens here.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  checkLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
}));

const PICKER_HREF = "/settings/location-picker";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <KeepLocationUpdated />,
      [PICKER_HREF.slice(1)]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_LOCATION.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Settings › Location's choose-city control", () => {
  it.each([true, false])(
    "opens the city picker from the control the CI flow taps (permission %s)",
    async (granted) => {
      jest.mocked(checkLocationPermission).mockResolvedValue({ granted, canRequestAgain: true });
      await renderScreen();

      await userEvent.press(await screen.findByTestId(E2E_ID.LOCATION_CHOOSE_CITY));

      expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(PICKER_HREF));
    }
  );
});

describe("Settings › Location's failure line", () => {
  afterEach(() => {
    useLocationStore.setState({ locationDetails: initialLocationDetails });
  });

  it.each([
    [LOCATION_FAILURE.TIMEOUT, "location.update.error"],
    [LOCATION_FAILURE.UNAVAILABLE, "location.update.error"],
    [LOCATION_FAILURE.SERVICES_OFF, "location.update.error"],
    [LOCATION_FAILURE.DENIED, "location.permission.deniedMessage"],
  ])("shows the %s failure as locale copy", async (kind, key) => {
    jest.mocked(checkLocationPermission).mockResolvedValue({
      granted: true,
      canRequestAgain: true,
    });
    useLocationStore.setState({ locationDetails: { ...initialLocationDetails, error: kind } });
    await renderScreen();

    expect(await screen.findByText(i18n.t(key))).toBeOnTheScreen();
    expect(screen.queryByText(kind)).toBeNull();
  });
});
