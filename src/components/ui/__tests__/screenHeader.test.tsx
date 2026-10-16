import type { ReactElement } from "react";
import { Text } from "react-native";
import { Settings } from "lucide-react-native";
import { router, Stack, Tabs, usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { act, renderRouter, screen, within } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

const TITLE = "Alarm settings";
const ACTION_LABEL = "Open alarm settings";
const SUBTITLE = "Sounds, challenges and snooze";
/** A screen no back control can name. */
const UNNAMED_ROUTE = "settings/alarm-debug";
const UMRAH_LAYOUT = "umrah/_layout";
const UMRAH_PREPARE_LAYOUT = "umrah/prepare/_layout";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const HeaderlessStack = () => <Stack screenOptions={{ headerShown: false }} />;

/** The app's navigator shape: a root stack over tabs and nested stacks. */
const renderApp = async (header: ReactElement, initialUrl = "/", isRTL = false) =>
  renderRouter(
    {
      _layout: () => (
        <>
          <HeaderlessStack />
          <Pathname />
        </>
      ),
      "(tabs)/_layout": () => <Tabs screenOptions={{ headerShown: false }} />,
      [BACK_DESTINATION.HOME.route]: () => null,
      [BACK_DESTINATION.TOOLS.route]: () => null,
      [BACK_DESTINATION.SETTINGS.route]: () => null,
      [BACK_DESTINATION.QURAN.route]: () => null,
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => header,
      [UNNAMED_ROUTE]: () => null,
      [UMRAH_LAYOUT]: HeaderlessStack,
      [BACK_DESTINATION.UMRAH.route]: () => header,
      [UMRAH_PREPARE_LAYOUT]: HeaderlessStack,
      [BACK_DESTINATION.UMRAH_PREPARE.route]: () => header,
      [BACK_DESTINATION.UMRAH_IHRAM.route]: () => header,
    },
    {
      initialUrl,
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

const go = (path: string) => act(() => router.push(path as never));

// userEvent drives the host view's responder, as a finger does.
const press = (name: string) => userEvent.setup().press(screen.getByRole("button", { name }));

const pathname = () => screen.getByTestId("pathname");

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

    // The helper builds labels through i18n; one literal pins the English wording itself.
    it("says 'Back to More' in English", async () => {
      await act(() => i18n.changeLanguage(AppLocale.EN));
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: "Back to More" })).toBeOnTheScreen();
    });

    it("names a different parent when reached from it", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.SETTINGS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("SETTINGS") })).toBeOnTheScreen();
    });

    // The What's New sheet can push a header screen over any tab, the Quran tab included.
    it("names the Quran tab", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.QURAN.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("QURAN") })).toBeOnTheScreen();
    });

    // The label and the press must agree, or the control lies about where it goes.
    it("lands where it says", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      await press(backTo("TOOLS"));

      expect(pathname()).toHaveTextContent(normalizeRoutePath(BACK_DESTINATION.TOOLS.href));
    });

    it("falls back to its parent when opened cold", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} back={{ fallback: BACK_DESTINATION.SETTINGS }} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      await press(backTo("SETTINGS"));

      expect(pathname()).toHaveTextContent(normalizeRoutePath(BACK_DESTINATION.SETTINGS.href));
    });

    // A fallback is for a cold open only; with a screen behind, back still pops to it.
    it("pops rather than falls back when a screen is behind", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} back={{ fallback: BACK_DESTINATION.SETTINGS }} />
      );
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      await press(backTo("TOOLS"));

      expect(pathname()).toHaveTextContent(normalizeRoutePath(BACK_DESTINATION.TOOLS.href));
    });

    it("goes to a fixed screen whatever is behind", async () => {
      await renderApp(<ScreenHeader title={TITLE} back={{ to: BACK_DESTINATION.TOOLS }} />);
      await go(BACK_DESTINATION.SETTINGS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      await press(backTo("TOOLS"));

      expect(pathname()).toHaveTextContent(normalizeRoutePath(BACK_DESTINATION.TOOLS.href));
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

    it("names its parent again when pushed a second time", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.SETTINGS.href);
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);
      await act(() => router.back());
      await go(BACK_DESTINATION.SETTINGS_ALARM.href);

      expect(screen.getByRole("button", { name: backTo("SETTINGS") })).toBeOnTheScreen();
    });
  });

  describe("back in nested stacks", () => {
    it("names the tab a new stack opened over", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.UMRAH.href);

      expect(screen.getByRole("button", { name: backTo("TOOLS") })).toBeOnTheScreen();
    });

    it("names the screen under a stack opened inside another", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.UMRAH.href);
      await go(BACK_DESTINATION.UMRAH_PREPARE.href);

      expect(screen.getByRole("button", { name: backTo("UMRAH") })).toBeOnTheScreen();
    });

    it("names the screen below it in the same nested stack", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.UMRAH.href);
      await go(BACK_DESTINATION.UMRAH_PREPARE.href);
      await go(BACK_DESTINATION.UMRAH_IHRAM.href);

      expect(screen.getByRole("button", { name: backTo("UMRAH_PREPARE") })).toBeOnTheScreen();
    });

    it("names the screen behind again once back on it", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />);
      await go(BACK_DESTINATION.TOOLS.href);
      await go(BACK_DESTINATION.UMRAH.href);
      await go(BACK_DESTINATION.UMRAH_PREPARE.href);
      await go(BACK_DESTINATION.UMRAH_IHRAM.href);

      await press(backTo("UMRAH_PREPARE"));

      expect(pathname()).toHaveTextContent(normalizeRoutePath(BACK_DESTINATION.UMRAH_PREPARE.href));
      expect(screen.getByRole("button", { name: backTo("UMRAH") })).toBeOnTheScreen();
    });

    it("hides when a deep link opens the nested stack cold", async () => {
      await renderApp(<ScreenHeader title={TITLE} back />, BACK_DESTINATION.UMRAH_IHRAM.href);

      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("action", () => {
    it("is a labelled button that fires", async () => {
      const onPress = jest.fn();
      await renderApp(
        <ScreenHeader title={TITLE} action={{ icon: Settings, label: ACTION_LABEL, onPress }} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      await press(ACTION_LABEL);

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

    it("sets the subtitle after the title", async () => {
      await renderApp(
        <ScreenHeader title={TITLE} subtitle={SUBTITLE} />,
        BACK_DESTINATION.SETTINGS_ALARM.href
      );

      const texts = screen.getAllByText(new RegExp(`^(${TITLE}|${SUBTITLE})$`));

      expect(texts.map((node) => node.props.children)).toEqual([TITLE, SUBTITLE]);
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
