// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the screen must bind to the mock below, not to its empty one.
import ToolsScreen from "@/app/(tabs)/tools";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { controlProblems } from "@/test-helpers/controls";

import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("@/hooks/useAlarmSupported", () => ({ useAlarmSupported: () => true }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderMore = () =>
  renderRouter(
    {
      [BACK_DESTINATION.TOOLS.route]: () => (
        <>
          <ToolsScreen />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.HIJRI_CALENDAR.route]: () => <Pathname />,
      [BACK_DESTINATION.SETTINGS.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.TOOLS.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const TILE_ORDER = [
  "tools.compass.title",
  "hijriCalendar.title",
  "tools.hijriConverter.title",
  "importantDays.title",
  "tools.qada.title",
  "umrah.title",
];

describe("More", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    useLocationStore.setState({ localizedLocation: { city: "Riyadh", country: "Saudi Arabia" } });
  });

  // More sits on the same sky as Today, never a plain canvas.
  it("draws the sky behind its content", async () => {
    await renderMore();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true }).length).toBe(1);
  });

  it("heads the screen with its name and the user's place", async () => {
    await renderMore();

    expect(screen.getByRole("header", { name: i18n.t("tools.title") })).toBeTruthy();
    expect(screen.getByText("Riyadh, Saudi Arabia")).toBeTruthy();
  });

  it("lays out the six tools in order, with no subtitles", async () => {
    await renderMore();

    const labels = screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);
    const tiles = labels.filter((label) => TILE_ORDER.map((key) => i18n.t(key)).includes(label));
    expect(tiles).toEqual(TILE_ORDER.map((key) => i18n.t(key)));
  });

  it("tells a screen reader where each tile leads", async () => {
    await renderMore();
    const hintOf = (key: string) =>
      screen.getByRole("button", { name: i18n.t(key) }).props.accessibilityHint;

    expect(hintOf("tools.compass.title")).toBe(
      i18n.t("a11y.opens", { name: i18n.t("tools.compass.title") })
    );
    expect(hintOf("importantDays.title")).toBe(i18n.t("a11y.tools.occasionsHint"));
  });

  // The occasions are marked on the Hijri calendar.
  it("opens the Hijri calendar from Important days", async () => {
    await renderMore();

    await userEvent.press(screen.getByRole("button", { name: i18n.t("importantDays.title") }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.HIJRI_CALENDAR.href)
    );
  });

  it("opens Settings from the gateway at the foot", async () => {
    await renderMore();

    await userEvent.press(
      screen.getByRole("button", {
        name: `${i18n.t("settings.title")}, ${i18n.t("tools.settings.status")}`,
      })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS.href)
    );
  });

  it("shows the alarms and listening rows with their state", async () => {
    await renderMore();

    expect(
      screen.getByRole("button", { name: new RegExp(`^${i18n.t("tools.alarm.title")}, `) })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: new RegExp(`^${i18n.t("tools.quranListen.title")}, `) })
    ).toBeTruthy();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderMore();

    expect(controlProblems()).toEqual([]);
  });
});
