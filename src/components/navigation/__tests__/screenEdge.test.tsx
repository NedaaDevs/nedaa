import { use, useEffect } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { Stack } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { renderRouter, screen } from "expo-router/testing-library";

import {
  rootScreenLayout,
  screenTopEdgeId,
  tabScreenLayout,
} from "@/components/navigation/screen-edge";
import { ALARM_SCREEN_PATH } from "@/constants/Alarm";
import { BACK_DESTINATION, TAB_GROUP } from "@/constants/BackDestinations";
import { PRESENTATION } from "@/constants/Navigation";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { UnderStatusBarContext } from "@/contexts/UnderStatusBarContext";
import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { QuranTheme } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { ThemeProvider } from "@/test-helpers/theme";
import config from "../../../../tamagui.config";

const mockInsets = { top: 59, right: 0, bottom: 0, left: 0 };
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => mockInsets,
}));

const LAYOUT = "_layout";
// A root route's name is its path without the leading slash.
const RING_ROUTE = ALARM_SCREEN_PATH.RING.slice(1);
const APP_BACKGROUND = config.themes.light.background.val;
const SEPIA_PAPER = QURAN_THEME_COLORS[QuranTheme.SEPIA].background;

const originalOS = Platform.OS;
const setPlatform = (os: PlatformTypeValue | typeof Platform.OS) =>
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });

let ringMounts = 0;
/** Declares its presentation from inside, as the alarm screens do. */
const RingStandIn = () => {
  useEffect(() => {
    ringMounts += 1;
  }, []);
  return <Stack.Screen options={{ presentation: PRESENTATION.FULL_SCREEN_MODAL }} />;
};

const UNDER_STATUS_BAR = "under-status-bar";
/** Shows the status bar its edge leaves it to draw under, if any. */
const ScreenStandIn = () => (
  <Text testID={UNDER_STATUS_BAR}>{String(use(UnderStatusBarContext))}</Text>
);

// The tabs render only the tabs they declare.
const TAB_STAND_INS = [BACK_DESTINATION.HOME, BACK_DESTINATION.ATHKAR, BACK_DESTINATION.QURAN];
const tabName = (route: string) => route.slice(`${TAB_GROUP}/`.length);

const renderApp = (initialUrl: string) =>
  renderRouter(
    {
      [LAYOUT]: () => (
        <Stack screenOptions={{ headerShown: false }} screenLayout={rootScreenLayout} />
      ),
      [`${TAB_GROUP}/${LAYOUT}`]: () => (
        <Tabs
          tabBar={() => null}
          screenOptions={{ headerShown: false }}
          screenLayout={tabScreenLayout}>
          {TAB_STAND_INS.map(({ route }) => (
            <Tabs.Screen key={route} name={tabName(route)} />
          ))}
        </Tabs>
      ),
      ...Object.fromEntries(TAB_STAND_INS.map(({ route }) => [route, ScreenStandIn])),
      [BACK_DESTINATION.SETTINGS_ABOUT.route]: ScreenStandIn,
      [BACK_DESTINATION.SETTINGS_PROVIDER.route]: ScreenStandIn,
      [BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS.route]: ScreenStandIn,
      [RING_ROUTE]: RingStandIn,
    },
    { initialUrl, wrapper: ThemeProvider }
  );

/** The top a screen's edge pads, and the band it paints there. */
const edgeOf = (route: string) => {
  const { paddingTop = 0, backgroundColor } = StyleSheet.flatten(
    screen.getByTestId(screenTopEdgeId(route)).props.style
  );
  return { paddingTop, backgroundColor };
};

const OPEN = { paddingTop: 0 };
const padded = (band: string) => ({ paddingTop: mockInsets.top, backgroundColor: band });

describe("screen top edge", () => {
  beforeEach(() => {
    ringMounts = 0;
    useQuranStore.setState({
      readerActive: false,
      quranTheme: QuranTheme.SEPIA,
      quranThemeOverride: true,
    });
  });

  afterEach(() => setPlatform(originalOS));

  it.each([
    BACK_DESTINATION.SETTINGS_ABOUT,
    BACK_DESTINATION.SETTINGS_PROVIDER,
    BACK_DESTINATION.HOME,
  ])("leaves the top of $route to its sky", async ({ route, href }) => {
    await renderApp(href);

    expect(edgeOf(route)).toEqual(OPEN);
  });

  it.each([BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS, BACK_DESTINATION.ATHKAR])(
    "pads the top of $route in the app's background",
    async ({ route, href }) => {
      await renderApp(href);

      expect(edgeOf(route)).toEqual(padded(APP_BACKGROUND));
    }
  );

  it.each([BACK_DESTINATION.SETTINGS_ABOUT, BACK_DESTINATION.HOME])(
    "tells $route the height of the status bar it draws under",
    async ({ href }) => {
      await renderApp(href);

      expect(screen.getByTestId(UNDER_STATUS_BAR)).toHaveTextContent(String(mockInsets.top));
    }
  );

  it.each([BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS, BACK_DESTINATION.ATHKAR])(
    "tells $route its top is padded",
    async ({ href }) => {
      await renderApp(href);

      expect(screen.getByTestId(UNDER_STATUS_BAR)).toHaveTextContent(String(null));
    }
  );

  // The tabs pad each tab, whatever Today draws.
  it("wraps no edge around the tabs", async () => {
    await renderApp(BACK_DESTINATION.ATHKAR.href);

    expect(screen.queryByTestId(screenTopEdgeId(TAB_GROUP))).toBeNull();
  });

  // iOS presents it outside the app's frame, so it pads its own top.
  it("leaves a full-screen modal's top to the modal", async () => {
    await renderApp(ALARM_SCREEN_PATH.RING);

    expect(edgeOf(RING_ROUTE)).toEqual(OPEN);
  });

  // The presentation arrives after the first frame, from inside the screen.
  it("keeps a full-screen modal mounted as its presentation arrives", async () => {
    await renderApp(ALARM_SCREEN_PATH.RING);

    expect(ringMounts).toBe(1);
  });

  describe("the Quran tab", () => {
    // Hiding the bars then never reflows the page.
    it("leaves the Android reader's top open", async () => {
      setPlatform(PlatformType.ANDROID);
      useQuranStore.setState({ readerActive: true });
      await renderApp(BACK_DESTINATION.QURAN.href);

      expect(edgeOf(BACK_DESTINATION.QURAN.route)).toEqual(OPEN);
    });

    it("pads the iOS reader in the page's paper", async () => {
      setPlatform(PlatformType.IOS);
      useQuranStore.setState({ readerActive: true });
      await renderApp(BACK_DESTINATION.QURAN.href);

      expect(edgeOf(BACK_DESTINATION.QURAN.route)).toEqual(padded(SEPIA_PAPER));
    });

    it.each(Object.values(PlatformType))(
      "pads the tab's chrome in the app's background on %s",
      async (os) => {
        setPlatform(os);
        await renderApp(BACK_DESTINATION.QURAN.href);

        expect(edgeOf(BACK_DESTINATION.QURAN.route)).toEqual(padded(APP_BACKGROUND));
      }
    );
  });
});
