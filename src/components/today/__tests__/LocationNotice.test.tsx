import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { LocationNotice } from "@/components/today/LocationNotice";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import i18n from "@/localization/i18n";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderNotice = () =>
  renderRouter(
    {
      "(tabs)/index": () => (
        <>
          <LocationNotice />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    { initialUrl: "/", wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

describe("LocationNotice", () => {
  // The times fall back to Makkah so the app works without a location; say so.
  it("says the times are Makkah's while no location is known", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderNotice();

    expect(screen.getByLabelText(i18n.t("today.defaultLocation.body"))).toBeTruthy();
  });

  it("stays away once the times are for the user's own place", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: false });
    await renderNotice();

    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.body"))).toBeNull();
  });

  it("opens the location settings to set one", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderNotice();

    await userEvent.press(
      screen.getByRole("button", { name: i18n.t("today.defaultLocation.action") })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });
});
