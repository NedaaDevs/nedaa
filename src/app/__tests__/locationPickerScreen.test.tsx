// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import LocationPickerScreen from "@/app/settings/location-picker";
import { renderRouter, screen } from "expo-router/testing-library";

import { CITY_PICKER_VIEW, LOCATION_PICKER } from "@/constants/Location";
import i18n from "@/localization/i18n";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/components/location/CityPicker", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/location/CoordinateEntry", () => ({
  __esModule: true,
  default: () => null,
}));

const renderPicker = (url: string) =>
  renderRouter(
    { [LOCATION_PICKER.href.slice(1)]: () => <LocationPickerScreen /> },
    { initialUrl: url, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

describe("Settings › Location › city picker", () => {
  it("opens on the city list by default", async () => {
    await renderPicker(LOCATION_PICKER.href);

    expect(screen.getByRole("header", { name: i18n.t("location.picker.title") })).toBeTruthy();
  });

  // A failed read offers coordinates straight away.
  it("opens on the coordinates when asked to", async () => {
    await renderPicker(
      `${LOCATION_PICKER.href}?${LOCATION_PICKER.viewParam}=${CITY_PICKER_VIEW.COORDINATES}`
    );

    expect(screen.getByRole("header", { name: i18n.t("location.coordinates.title") })).toBeTruthy();
  });
});
