// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import PrivacyScreen from "@/app/settings/privacy";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** Rows that lead on, each closing the group whose topic it controls. */
const LINKS = [
  { to: BACK_DESTINATION.SETTINGS_LOCATION },
  { to: BACK_DESTINATION.SETTINGS_FEEDBACK },
  { to: BACK_DESTINATION.SETTINGS_PREFERENCES },
] as const;

const renderPrivacy = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_PRIVACY.route]: () => (
        <>
          <PrivacyScreen />
          <Pathname />
        </>
      ),
      ...Object.fromEntries(LINKS.map(({ to }) => [to.route, () => <Pathname />])),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_PRIVACY.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const SECTIONS = [
  "settings.privacy.leaves.title",
  "settings.privacy.stays.title",
  "settings.privacy.share.title",
  "settings.privacy.usage.title",
  "settings.privacy.never.title",
];

/** Each point's own heading, so a reader can move from fact to fact. */
const POINTS = [
  "settings.privacy.location.title",
  "settings.privacy.city.title",
  "settings.privacy.requests.title",
  "settings.privacy.records.title",
  "settings.privacy.reports.title",
  "settings.privacy.counts.title",
  "settings.privacy.ads.title",
];

const preferencesRow = (statusKey: string) =>
  screen.getByRole("button", {
    name: `${i18n.t("settings.preferences.title")}, ${i18n.t(statusKey)}`,
  });

/** The service the server asks for the city name and its time zone. */
const CITY_SERVICE = "BigDataCloud";

describe("Privacy", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ shareUsageStats: true });
  });

  it("draws the sky behind its content", async () => {
    await renderPrivacy();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true }).length).toBe(1);
  });

  it("heads the screen with its name", async () => {
    await renderPrivacy();

    expect(screen.getByRole("header", { name: i18n.t("settings.privacy.title") })).toBeTruthy();
  });

  it("names what leaves, what stays, what you share, the usage stats and what never happens", async () => {
    await renderPrivacy();

    const headers = screen.getAllByRole("header").map((node) => node.props.children);
    expect(headers.filter((text) => SECTIONS.map((k) => i18n.t(k)).includes(text))).toEqual(
      SECTIONS.map((key) => i18n.t(key))
    );
  });

  it("heads each point, in order", async () => {
    await renderPrivacy();

    const headers = screen.getAllByRole("header").map((node) => node.props.children);
    expect(headers.filter((text) => POINTS.map((k) => i18n.t(k)).includes(text))).toEqual(
      POINTS.map((key) => i18n.t(key))
    );
  });

  // Points are statements; only the rows that lead on can be pressed.
  it("offers no press on a point", async () => {
    await renderPrivacy();

    for (const key of POINTS) {
      expect(screen.queryByRole("button", { name: new RegExp(i18n.t(key)) })).toBeNull();
    }
  });

  // The usage stats have a section of their own, so the name shows once.
  it("names the usage stats once", async () => {
    await renderPrivacy();

    expect(screen.getAllByText(i18n.t("settings.privacy.usage.title"))).toHaveLength(1);
  });

  it.each(LINKS)("opens $to.route from its row", async ({ to }) => {
    await renderPrivacy();
    const row = screen.getByRole("button", { name: new RegExp(`^${i18n.t(to.title)}`) });

    expect(row.props.accessibilityHint).toBe(i18n.t("a11y.opens", { name: i18n.t(to.title) }));
    await userEvent.press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(to.href));
  });

  it("states the usage stats plainly", async () => {
    await renderPrivacy();

    expect(screen.getByText(i18n.t("settings.privacy.usage.body"))).toBeTruthy();
  });

  it.each([
    [true, "settings.privacy.usage.on"],
    [false, "settings.privacy.usage.off"],
  ])("shows the usage stats switch as %s beside Preferences", async (on, statusKey) => {
    usePreferencesStore.setState({ shareUsageStats: on });
    await renderPrivacy();

    expect(preferencesRow(statusKey)).toBeTruthy();
  });

  it("opens Preferences, where the switch lives", async () => {
    await renderPrivacy();
    const row = preferencesRow("settings.privacy.usage.on");

    expect(row.props.accessibilityHint).toBe(
      i18n.t("a11y.opens", { name: i18n.t("settings.preferences.title") })
    );
    await userEvent.press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_PREFERENCES.href)
    );
  });

  // The reader learns who gets the coordinates: the chosen provider by the
  // name the app shows it under, and the city-name service.
  it("names the services the server asks", async () => {
    await renderPrivacy();

    const provider = i18n.t("providers.aladhan.title");
    expect(screen.getByText(new RegExp(provider))).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(CITY_SERVICE))).toBeOnTheScreen();
  });
});
