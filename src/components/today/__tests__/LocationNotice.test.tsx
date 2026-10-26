import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { LocationNotice } from "@/components/today/LocationNotice";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import i18n from "@/localization/i18n";
import { placeFacts } from "@/test-helpers/place";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { controlProblems } from "@/test-helpers/controls";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderNotice = () =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <LocationNotice />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("LocationNotice", () => {
  // The times fall back to Makkah so the app works without a location; say so.
  it("says the times are Makkah's while no location is known", async () => {
    placeFacts(true, null);
    await renderNotice();

    expect(screen.getByLabelText(i18n.t("today.defaultLocation.body"))).toBeTruthy();
  });

  // A found place is no failure to find one; its times are what is missing.
  it("says Makkah's times stand in until a found place's times load", async () => {
    placeFacts(true, RIYADH_COORDS);
    await renderNotice();

    expect(screen.getByLabelText(i18n.t("today.defaultLocation.awaitingTimes"))).toBeTruthy();
    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.body"))).toBeNull();
  });

  it("stays away once the times are for the user's own place", async () => {
    placeFacts(false, RIYADH_COORDS);
    await renderNotice();

    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.body"))).toBeNull();
    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.awaitingTimes"))).toBeNull();
  });

  it("opens the location settings to set one", async () => {
    placeFacts(true, null);
    await renderNotice();

    await userEvent.press(
      screen.getByRole("button", { name: i18n.t("today.defaultLocation.action") })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    placeFacts(true, null);
    await renderNotice();

    expect(controlProblems()).toEqual([]);
  });
});
