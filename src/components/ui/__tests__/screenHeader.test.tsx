import type { ReactElement } from "react";
import { Text } from "react-native";
import { Settings } from "lucide-react-native";
import { router, Stack, Tabs, usePathname } from "expo-router";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { RTLContext } from "@/contexts/RTLContext";
import { ScreenHeader } from "@/components/ui/screen-header";
import i18n from "@/localization/i18n";
import { normalizeRoutePath } from "@/test-helpers/routeTree";

// RTLContext reaches the app store, which persists through SQLite.
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const TITLE = "Alarm settings";
const ACTION_LABEL = "Open alarm settings";
const SUBTITLE = "Sounds, challenges and snooze";
/** A screen no back control can name. */
const UNNAMED_ROUTE = "settings/alarm-debug";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** The app's navigator shape: a root stack over tabs, plus pushed settings screens. */
const renderApp = async (header: ReactElement, initialUrl = "/", isRTL = false) =>
  renderRouter(
    {
      _layout: () => (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          <Pathname />
        </>
      ),
      "(tabs)/_layout": () => <Tabs screenOptions={{ headerShown: false }} />,
      "(tabs)/index": () => null,
      "(tabs)/tools": () => null,
      "(tabs)/settings": () => null,
      "settings/alarm": () => header,
      [UNNAMED_ROUTE]: () => null,
    },
    {
      initialUrl,
      wrapper: ({ children }) => (
        <TamaguiProvider config={config} defaultTheme="light">
          <RTLContext value={{ isRTL, direction: isRTL ? "rtl" : "ltr" }}>{children}</RTLContext>
        </TamaguiProvider>
      ),
    }
  );

const go = (path: string) => act(() => router.push(path as never));

const backTo = (destination: keyof typeof BACK_DESTINATION) =>
  i18n.t("a11y.backTo", { screen: i18n.t(BACK_DESTINATION[destination].title) });

describe("ScreenHeader", () => {
  it("announces the title as a header", async () => {
    await renderApp(<ScreenHeader title={TITLE} />, BACK_DESTINATION.SETTINGS_ALARM.href);

    expect(screen.getByRole("header", { name: TITLE })).toBeOnTheScreen();
  });

  describe("back", () => {
    it("names the tab it returns to", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("TOOLS") })).toBeOnTheScreen();
    });

    it("names a different parent when reached from it", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.SETTINGS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("SETTINGS") })).toBeOnTheScreen();
    });

    // The label and the press must agree, or the control lies about where it goes.
    it("lands where it says", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      await act(() => fireEvent.press(screen.getByRole("button", { name: backTo("TOOLS") })));

      expect(screen.getByTestId("pathname")).toHaveTextContent(
        normalizeRoutePath(BACK_DESTINATION.TOOLS.href)
      );
    });

    it("falls back to its parent when opened cold", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} back={{ fallback: BACK_DESTINATION.SETTINGS }} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      await act(() => fireEvent.press(screen.getByRole("button", { name: backTo("SETTINGS") })));

      expect(screen.getByTestId("pathname")).toHaveTextContent(
        normalizeRoutePath(BACK_DESTINATION.SETTINGS.href)
      );
    });

    it("goes to a fixed screen whatever is behind", async () => {
      await renderApp(<ScreenHeader title={TITLE} back={{ to: BACK_DESTINATION.TOOLS }} />);
      await go(BACK_DESTINATION.SETTINGS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("TOOLS") })).toBeOnTheScreen();
    });

    it("says only 'back' when the destination has no name", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(`/${UNNAMED_ROUTE}`);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: i18n.t("a11y.back") })).toBeOnTheScreen();
    });

    it("hides when there is nowhere to go", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />, BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.queryByRole("button")).toBeNull();
    });

    it("holds the touch floor", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} back={{ fallback: BACK_DESTINATION.SETTINGS }} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      expect(screen.getByRole("button", { name: backTo("SETTINGS") })).toHaveStyle({
        minHeight: 44,
        minWidth: 44,
      });
    });
  });

  describe("action", () => {
    it("is a labelled button that fires", async () => {
      const onPress = jest.fn();
      await renderApp(
        <ScreenHeader title={TITLE} action={{ icon: Settings, label: ACTION_LABEL, onPress }} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      await act(() => fireEvent.press(screen.getByRole("button", { name: ACTION_LABEL })));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    // Stacked sets the controls on one row above the title; the bar puts the title between them.
    it.each([
      { variant: "stacked", rtl: false, order: [backTo("SETTINGS"), ACTION_LABEL, TITLE] },
      { variant: "stacked", rtl: true, order: [backTo("SETTINGS"), ACTION_LABEL, TITLE] },
      { variant: "bar", rtl: false, order: [backTo("SETTINGS"), TITLE, ACTION_LABEL] },
      { variant: "bar", rtl: true, order: [backTo("SETTINGS"), TITLE, ACTION_LABEL] },
    ] as const)("$variant reads in visual order (rtl: $rtl)", async ({ variant, rtl, order }) => {
      await renderApp(
        <ScreenHeader
          title={TITLE}
          variant={variant}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
          action={{ icon: Settings, label: ACTION_LABEL, onPress: () => {} }}
        />,
        BACK_DESTINATION.SETTINGS_ALARM.href,
        rtl
      );

      const names = screen
        .getAllByRole(/button|header/)
        .map((node) => node.props.accessibilityLabel ?? node.props.children);

      expect(names).toEqual(order);
    });
  });

  describe("stacked", () => {
    it("shows the destination's name beside the chevron", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(
        within(screen.getByRole("button", { name: backTo("TOOLS") })).getByText(
          i18n.t(BACK_DESTINATION.TOOLS.title)
        )
      ).toBeOnTheScreen();
    });

    it("shows only the chevron when the destination has no name", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(`/${UNNAMED_ROUTE}`);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(
        within(screen.getByRole("button", { name: i18n.t("a11y.back") })).queryByText(/./)
      ).toBeNull();
    });

    it("sets the subtitle under the title", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} subtitle={SUBTITLE} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      expect(screen.getByText(SUBTITLE)).toBeOnTheScreen();
    });
  });

  describe("bar", () => {
    it("names the destination only to the screen reader", async () => {
      await renderApp(<ScreenHeader title={TITLE} variant="bar" back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(
        within(screen.getByRole("button", { name: backTo("TOOLS") })).queryByText(/./)
      ).toBeNull();
    });
  });
});
